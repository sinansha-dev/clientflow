import type { NextFunction, Request, Response } from 'express';
import { accessCookieName } from '../utils/cookies';
import { unauthorized } from '../utils/errors';
import { verifyAccessToken } from '../utils/tokens';
import { userRepository } from '../repositories/user.repository';

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization?.replace('Bearer ', '');
    const token = header || req.signedCookies[accessCookieName];
    if (!token) {
      throw unauthorized();
    }

    const payload = verifyAccessToken(token);
    const user = await userRepository.findActiveById(payload.sub);
    if (!user) {
      throw unauthorized();
    }

    req.user = user;
    next();
  } catch {
    next(unauthorized('Session expired'));
  }
}
