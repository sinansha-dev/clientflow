import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@clientflow/types';
import { forbidden } from '../utils/errors';

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(forbidden());
      return;
    }
    next();
  };
}
