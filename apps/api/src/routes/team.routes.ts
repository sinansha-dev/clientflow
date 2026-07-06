import { Router } from 'express';
import { z } from 'zod';
import { teamController } from '../controllers/team.controller';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { teamMemberProfileSchema, uuidSchema } from '@clientflow/shared';

export const teamRoutes = Router();

const idParams = z.object({ id: uuidSchema });

teamRoutes.use(requireAuth);

teamRoutes.get('/', requireRole('ADMIN', 'DEVELOPER'), (req, res, next) =>
  teamController.list(req, res).catch(next),
);

teamRoutes.post('/invite', requireRole('ADMIN'), (req, res, next) =>
  teamController.invite(req, res).catch(next),
);

teamRoutes.post('/', requireRole('ADMIN'), (req, res, next) =>
  teamController.create(req, res).catch(next),
);

teamRoutes.get(
  '/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  (req, res, next) => teamController.getById(req, res).catch(next),
);

teamRoutes.patch(
  '/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  validate(teamMemberProfileSchema.partial()),
  (req, res, next) => teamController.update(req, res).catch(next),
);

teamRoutes.patch(
  '/:id/status',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  validate(z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) })),
  (req, res, next) => teamController.updateStatus(req, res).catch(next),
);

teamRoutes.post(
  '/:id/reset-password',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  validate(z.object({ password: z.string().min(6, 'Password must be at least 6 characters') })),
  (req, res, next) => teamController.resetPassword(req, res).catch(next),
);
