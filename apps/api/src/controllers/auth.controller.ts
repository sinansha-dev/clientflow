import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { clearAuthCookies, refreshCookieName, setAuthCookies } from '../utils/cookies';
import { ok } from '../utils/http';

export const authController = {
  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    setAuthCookies(res, result.accessToken, result.refreshToken, req.body.rememberMe);
    return ok(res, 'Logged in successfully', { user: result.user, accessToken: result.accessToken });
  },

  async refresh(req: Request, res: Response) {
    const token = req.signedCookies[refreshCookieName] as string | undefined;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token is required', errors: [] });
    }
    const result = await authService.refresh(token);
    setAuthCookies(res, result.accessToken, result.refreshToken, true);
    return ok(res, 'Session refreshed', { user: result.user, accessToken: result.accessToken });
  },

  async logout(req: Request, res: Response) {
    await authService.logout(req.signedCookies[refreshCookieName], req.user?.id);
    clearAuthCookies(res);
    return ok(res, 'Logged out successfully');
  },

  async forgotPassword(req: Request, res: Response) {
    const { resetToken } = await authService.forgotPassword(req.body);
    return ok(res, 'If the account exists, reset instructions have been sent', {
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    });
  },

  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(req.body);
    return ok(res, 'Password reset successfully');
  },

  async me(req: Request, res: Response) {
    return ok(res, 'Current user', { user: req.user });
  },
};
