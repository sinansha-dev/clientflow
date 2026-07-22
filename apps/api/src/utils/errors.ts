export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
  }
}

export const unauthorized = (message = 'Unauthorized') => new AppError(401, message);
export const forbidden = (message = 'Forbidden') => new AppError(403, message);
export const notFound = (message = 'Resource not found') => new AppError(404, message);
export const badRequest = (message = 'Bad Request') => new AppError(400, message);
