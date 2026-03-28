export class CmsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...(Object.keys(this.context).length > 0 ? { context: this.context } : {}),
    };
  }
}

export class ValidationError extends CmsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, context ?? {});
  }
}

export class AuthError extends CmsError {
  constructor(message = 'Authentication required') {
    super('AUTH_ERROR', message, 401);
  }
}

export class ForbiddenError extends CmsError {
  constructor(message = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends CmsError {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      404,
      id ? { resource, id } : { resource },
    );
  }
}

export class ConflictError extends CmsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('CONFLICT', message, 409, context ?? {});
  }
}

export class PluginError extends CmsError {
  constructor(pluginName: string, message: string, context?: Record<string, unknown>) {
    super('PLUGIN_ERROR', `[${pluginName}] ${message}`, 500, { pluginName, ...context });
  }
}

export class InternalError extends CmsError {
  constructor(message = 'Internal server error') {
    super('INTERNAL_ERROR', message, 500);
  }
}
