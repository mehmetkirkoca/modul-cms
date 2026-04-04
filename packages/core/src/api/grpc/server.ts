import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { userRepository, toPublic } from '../../db/repositories/user.repository.js';
import { permissionRepository } from '../../db/repositories/permission.repository.js';
import { pluginRepository } from '../../db/repositories/plugin.repository.js';
import { configRepository } from '../../db/repositories/config.repository.js';
import { NotFoundError } from '../../errors/index.js';
import type { CoreEventBus } from '../../core/event-bus/index.js';

const PROTO_PATH = path.resolve(__dirname, '../../../proto/core.proto');

import type { PublicUser } from '../../db/repositories/user.repository.js';
function toGrpcUser(u: PublicUser) {
  return {
    id: u.id, email: u.email, name: u.name, role: u.role,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt.toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GrpcCall<T> = grpc.ServerUnaryCall<T, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GrpcCallback = grpc.sendUnaryData<any>;

function handle<T>(fn: (call: GrpcCall<T>, cb: GrpcCallback) => Promise<void>) {
  return async (call: GrpcCall<T>, cb: GrpcCallback) => {
    try {
      await fn(call, cb);
    } catch (err) {
      if (err instanceof NotFoundError) {
        cb({ code: grpc.status.NOT_FOUND, message: err.message }, null);
      } else {
        cb({ code: grpc.status.INTERNAL, message: (err as Error).message }, null);
      }
    }
  };
}

export function createGrpcServer(eventBus: CoreEventBus): grpc.Server {
  const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const proto = grpc.loadPackageDefinition(packageDef) as Record<string, unknown>;
  const CoreAPI = (proto['core'] as Record<string, unknown>)['CoreAPI'] as typeof grpc.Server;

  const server = new grpc.Server();

  server.addService((CoreAPI as unknown as { service: grpc.ServiceDefinition }).service, {

    GetUser: handle<{ id: string }>(async (call, cb) => {
      const user = await userRepository.findById(call.request.id);
      cb(null, toGrpcUser(user));
    }),

    ListUsers: handle<{ page: number; per_page: number; role: string }>(async (call, cb) => {
      const { page = 1, per_page = 20, role } = call.request;
      const result = await userRepository.list({ page, perPage: per_page, role: role || undefined });
      cb(null, { users: result.users.map(toGrpcUser), total: result.total });
    }),

    CheckPermission: handle<{ user_id: string; resource: string; action: string }>(async (call, cb) => {
      const { user_id, resource, action } = call.request;
      const allowed = await permissionRepository.check(user_id, resource, action);
      cb(null, { allowed, reason: allowed ? '' : 'Permission denied' });
    }),

    GetUserRoles: handle<{ user_id: string }>(async (call, cb) => {
      const role = await permissionRepository.getUserRole(call.request.user_id);
      cb(null, { roles: role ? [role] : [] });
    }),

    GetPlugin: handle<{ name: string }>(async (call, cb) => {
      const plugin = await pluginRepository.findByName(call.request.name);
      cb(null, {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        runtime: plugin.runtime,
        status: plugin.status,
      });
    }),

    ListPlugins: handle<{ status: string }>(async (call, cb) => {
      const plugins = await pluginRepository.list(call.request.status || undefined);
      cb(null, {
        plugins: plugins.map((p) => ({
          id: p.id,
          name: p.name,
          version: p.version,
          runtime: p.runtime,
          status: p.status,
        })),
      });
    }),

    GetConfig: handle<{ key: string }>(async (call, cb) => {
      const value = await configRepository.get(call.request.key);
      cb(null, {
        key: call.request.key,
        value: JSON.stringify(value),
      });
    }),

    EmitEvent: handle<{ event: string; payload: string; trace_id: string }>(async (call, cb) => {
      const { event, payload } = call.request;
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      const meta = await eventBus.emit(event, parsed);
      cb(null, { success: true, event_id: meta.eventId });
    }),

  });

  return server;
}

export async function startGrpcServer(server: grpc.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) return reject(err);
        console.info(`[gRPC] Server listening on port ${boundPort}`);
        resolve();
      },
    );
  });
}
