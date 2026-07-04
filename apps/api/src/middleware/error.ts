import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }

  const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
  if (statusCode >= 500) {
    logger.error({ error }, 'Unhandled application error');
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message ?? 'Internal server error',
    errors: error.errors ?? [],
  });
};
