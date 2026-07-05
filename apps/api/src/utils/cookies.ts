import type { Response } from 'express';
import { env, isProduction } from '../config/env';

export const accessCookieName = 'cf_access';
export const refreshCookieName = 'cf_refresh';

const allowSecureCookie =
  isProduction || env.WEB_ORIGIN.includes('localhost') || env.WEB_ORIGIN.includes('127.0.0.1');

const baseCookie = {
  httpOnly: true,
  secure: allowSecureCookie,
  sameSite: 'none' as const,
  signed: true,
  path: '/',
};

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  rememberMe: boolean,
): void {
  res.cookie(accessCookieName, accessToken, {
    ...baseCookie,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(refreshCookieName, refreshToken, {
    ...baseCookie,
    maxAge: (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(accessCookieName, { ...baseCookie });
  res.clearCookie(refreshCookieName, { ...baseCookie });
}

export const cookieSecret = env.COOKIE_SECRET;
