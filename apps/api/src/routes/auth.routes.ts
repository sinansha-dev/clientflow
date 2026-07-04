import { Router } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from '@clientflow/shared';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const authRoutes = Router();

authRoutes.post('/login', validate(loginSchema), (req, res, next) =>
  authController.login(req, res).catch(next),
);
authRoutes.post('/logout', requireAuth, (req, res, next) =>
  authController.logout(req, res).catch(next),
);
authRoutes.post('/refresh', (req, res, next) => authController.refresh(req, res).catch(next));
authRoutes.post('/forgot-password', validate(forgotPasswordSchema), (req, res, next) =>
  authController.forgotPassword(req, res).catch(next),
);
authRoutes.post('/reset-password', validate(resetPasswordSchema), (req, res, next) =>
  authController.resetPassword(req, res).catch(next),
);
authRoutes.get('/me', requireAuth, (req, res) => authController.me(req, res));
