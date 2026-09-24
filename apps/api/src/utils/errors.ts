/** An expected failure whose code and message are safe to return to the client. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, string[]> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code: string, message: string, details?: Record<string, string[]>) =>
  new AppError(400, code, message, details);

export const unauthorized = (message = 'Authentication required.', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);

export const forbidden = (
  message = 'You do not have access to this resource.',
  code = 'FORBIDDEN',
) => new AppError(403, code, message);

export const notFound = (resource: string) =>
  new AppError(404, 'NOT_FOUND', `${resource} not found.`);

export const conflict = (code: string, message: string, details?: Record<string, string[]>) =>
  new AppError(409, code, message, details);

export const unprocessable = (code: string, message: string, details?: Record<string, string[]>) =>
  new AppError(422, code, message, details);

export const serviceUnavailable = (code: string, message: string) =>
  new AppError(503, code, message);
