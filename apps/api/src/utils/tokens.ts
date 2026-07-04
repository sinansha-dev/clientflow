import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '@clientflow/types';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  role: AuthUser['role'];
  email: string;
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.JWT_SECRET, {
    expiresIn: '15m',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export function createOpaqueToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
