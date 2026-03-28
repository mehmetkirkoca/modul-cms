import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { Queue, Worker } from 'bullmq';
import type { EventBus as IEventBus, EventHandler, EventName, BaseEvent } from '@module-cms/sdk';

type EventHandlerMap = Map<EventName, EventHandler[]>;

/**
 * CoreEventBus
 *
 * - Sync events: in-process EventEmitter. < 10ms zorunlu.
 * - Async events: BullMQ (Redis). Container plugin'ler için.
 */
export class CoreEventBus implements IEventBus {
  private readonly emitter = new EventEmitter();
  private readonly syncHandlers: EventHandlerMap = new Map();
  private readonly asyncHandlers: EventHandlerMap = new Map();
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(private readonly redisUrl?: string) {
    this.emitter.setMaxListeners(100);
  }

  async initialize(): Promise<void> {
    if (!this.redisUrl) return;

    // Dynamic import — bullmq sadece Redis varsa yüklenir
    const { Queue, Worker } = await import('bullmq');
    const connection = this.parseRedisUrl(this.redisUrl);

    this.queue = new Queue('cms-events', { connection });

    this.worker = new Worker(
      'cms-events',
      async (job) => {
        const { eventName, payload, meta } = job.data as {
          eventName: string;
          payload: Record<string, unknown>;
          meta: BaseEvent;
        };
        const handlers = this.asyncHandlers.get(eventName) ?? [];
        await Promise.allSettled(handlers.map((h) => h(payload, meta)));
      },
      { connection },
    );

    this.worker.on('failed', (job, err) => {
      console.error(`[EventBus] Async event failed: ${job?.name}`, err);
    });
  }

  onSync<T extends object>(event: EventName, handler: EventHandler<T>): void {
    if (!this.syncHandlers.has(event)) this.syncHandlers.set(event, []);
    this.syncHandlers.get(event)!.push(handler as EventHandler);
    this.emitter.on(event, handler as EventHandler);
  }

  on<T extends object>(event: EventName, handler: EventHandler<T>): void {
    if (!this.asyncHandlers.has(event)) this.asyncHandlers.set(event, []);
    this.asyncHandlers.get(event)!.push(handler as EventHandler);
  }

  off(event: EventName, handler: EventHandler): void {
    const syncList = this.syncHandlers.get(event);
    if (syncList) {
      const idx = syncList.indexOf(handler);
      if (idx !== -1) syncList.splice(idx, 1);
    }
    const asyncList = this.asyncHandlers.get(event);
    if (asyncList) {
      const idx = asyncList.indexOf(handler);
      if (idx !== -1) asyncList.splice(idx, 1);
    }
    this.emitter.off(event, handler as never);
  }

  async emit<T extends object>(event: EventName, payload: T): Promise<BaseEvent> {
    const meta: BaseEvent = {
      eventId: randomUUID(),
      eventName: event,
      traceId: randomUUID(),
      timestamp: new Date().toISOString(),
      version: 1,
    };

    // 1. Sync handler'ları çalıştır — bir handler hata verse diğerleri çalışmaya devam eder
    const syncHandlers = this.syncHandlers.get(event) ?? [];
    for (const handler of syncHandlers) {
      try {
        await handler(payload, meta);
      } catch (err) {
        console.error(`[EventBus] Sync handler error for "${event}":`, err);
      }
    }
    this.emitter.emit(event, payload, meta);

    // 2. Async handler'ları queue'ya ekle (BullMQ)
    const hasAsyncHandlers = (this.asyncHandlers.get(event)?.length ?? 0) > 0;
    if (this.queue && hasAsyncHandlers) {
      await this.queue.add(event, { eventName: event, payload, meta }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    }

    return meta;
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private parseRedisUrl(url: string) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      db: parseInt(parsed.pathname.slice(1) || '0', 10),
    };
  }
}
