import type { EventBus, CoreUserCreatedPayload, CoreUserUpdatedPayload } from '@module-cms/sdk';
import { userSnapshotRepository } from '../repositories/user-snapshot.repository.js';

export function registerUserHandlers(eventBus: EventBus) {
  eventBus.onSync<CoreUserCreatedPayload>('core:user:created:v1', async ({ userId, email, name, role }) => {
    await userSnapshotRepository.upsert({ id: userId, email, name, role });
  });

  eventBus.onSync<CoreUserUpdatedPayload>('core:user:updated:v1', async ({ userId, email, name, role }) => {
    await userSnapshotRepository.upsert({ id: userId, email, name, role });
  });
}
