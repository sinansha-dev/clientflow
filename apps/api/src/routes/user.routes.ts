import { Router } from 'express';
import { z } from 'zod';
import {
  changePasswordSchema,
  createUserSchema,
  profileSchema,
  updateUserSchema,
  uuidSchema,
} from '@clientflow/shared';
import { userController } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

export const userRoutes = Router();
const idParams = z.object({ id: uuidSchema });

userRoutes.use(requireAuth);
userRoutes.get('/me', (req, res) => userController.me(req, res));
userRoutes.patch('/profile', validate(profileSchema), (req, res, next) =>
  userController.updateProfile(req, res).catch(next),
);
userRoutes.patch('/password', validate(changePasswordSchema), (req, res, next) =>
  userController.changePassword(req, res).catch(next),
);
userRoutes.get('/staff', requireRole('ADMIN', 'STAFF'), (req, res, next) =>
  userController.staff(req, res).catch(next),
);

userRoutes.get('/', requireRole('ADMIN'), (req, res, next) =>
  userController.list(req, res).catch(next),
);
userRoutes.post('/', requireRole('ADMIN'), validate(createUserSchema), (req, res, next) =>
  userController.create(req, res).catch(next),
);
userRoutes.patch(
  '/:id',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  validate(updateUserSchema),
  (req, res, next) => userController.update(req, res).catch(next),
);
userRoutes.delete('/:id', requireRole('ADMIN'), validate(idParams, 'params'), (req, res, next) =>
  userController.remove(req, res).catch(next),
);
