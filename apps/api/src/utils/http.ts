import type { Response } from 'express';
import type { ApiResponse } from '@clientflow/types';

export function ok<T>(res: Response, message: string, data?: T, status = 200): Response {
  const body: ApiResponse<T> = { success: true, message, data };
  return res.status(status).json(body);
}
