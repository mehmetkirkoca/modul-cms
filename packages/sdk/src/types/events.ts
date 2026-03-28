/**
 * Event naming convention: {domain}:{entity}:{action}:{version}
 * Örnek: content:post:saved:v1
 */
export type EventName = string;

export interface BaseEvent {
  eventId: string;
  eventName: EventName;
  traceId: string;
  timestamp: string; // ISO 8601
  version: number;
}

export type EventHandler<T extends object = object> = (
  payload: T,
  meta: BaseEvent,
) => void | Promise<void>;

export interface EventBus {
  /** Sync event — in-process plugin. < 10ms zorunlu. */
  onSync<T extends object>(event: EventName, handler: EventHandler<T>): void;

  /** Async event — BullMQ queue üzerinden. Container plugin için. */
  on<T extends object>(event: EventName, handler: EventHandler<T>): void;

  /** Event yayma. */
  emit<T extends object>(event: EventName, payload: T): Promise<BaseEvent>;

  off(event: EventName, handler: EventHandler): void;
}

// --- Core Events ---

export interface CoreUserCreatedPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export interface CoreUserUpdatedPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  changedFields: string[];
}

export interface CorePluginActivatedPayload {
  pluginName: string;
  version: string;
  runtime: 'in-process' | 'container';
}
