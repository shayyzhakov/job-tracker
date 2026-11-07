export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
