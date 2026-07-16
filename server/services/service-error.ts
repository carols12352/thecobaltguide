export type ServiceErrorCode =
  | "CONFLICT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATE";

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message: string,
    public readonly status: 403 | 404 | 409 = code === "NOT_FOUND"
      ? 404
      : code === "FORBIDDEN"
        ? 403
        : 409,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function notFound(message: string): ServiceError {
  return new ServiceError("NOT_FOUND", message, 404);
}

export function forbidden(message: string): ServiceError {
  return new ServiceError("FORBIDDEN", message, 403);
}

export function conflict(message: string): ServiceError {
  return new ServiceError("CONFLICT", message, 409);
}
