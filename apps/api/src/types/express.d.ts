import type { AuthUser } from '@clientflow/types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
