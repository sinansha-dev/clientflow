import { Router } from 'express';
import { z } from 'zod';
import { teamController } from '../controllers/team.controller';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { uuidSchema } from '@clientflow/shared';

export const teamRoutes = Router();

const idParams = z.object({ id: uuidSchema });
const profileUpdateSchema = z.object({
  employeeId: z.string().trim().optional().nullable().or(z.literal('')),
  jobTitle: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  department: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  skills: z.array(z.string().trim()).optional(),
  hourlyRate: z.coerce
    .number()
    .nonnegative('Hourly rate must be zero or greater')
    .optional()
    .nullable(),
  employmentType: z.enum(['Full-Time', 'Part-Time', 'Freelancer', 'Contractor']).optional(),
  joinDate: z.string().or(z.date()).optional().nullable().or(z.literal('')),
  availabilityStatus: z
    .enum([
      'Available',
      'Busy',
      'In Meeting',
      'On Leave',
      'Offline',
      'AVAILABLE',
      'BUSY',
      'IN_MEETING',
      'ON_LEAVE',
      'OFFLINE',
    ])
    .optional(),
  timezone: z.string().trim().optional(),
});

teamRoutes.use(requireAuth);

teamRoutes.get('/', requireRole('ADMIN', 'STAFF'), (req, res, next) =>
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
  requireRole('ADMIN', 'STAFF'),
  validate(idParams, 'params'),
  (req, res, next) => teamController.getById(req, res).catch(next),
);

teamRoutes.patch(
  '/:id',
  requireRole('ADMIN', 'STAFF'),
  validate(idParams, 'params'),
  validate(profileUpdateSchema),
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
