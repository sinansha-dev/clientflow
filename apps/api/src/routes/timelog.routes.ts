import { Router } from 'express';
import { z } from 'zod';
import { timelogController } from '../controllers/timelog.controller';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { timeLogSchema, updateTimeLogSchema, uuidSchema } from '@clientflow/shared';

export const timelogRoutes = Router();
export const timerRoutes = Router();

const idParams = z.object({ id: uuidSchema });

timelogRoutes.use(requireAuth);
timerRoutes.use(requireAuth);

// --- Time Log Routes ---
timelogRoutes.get('/', requireRole('ADMIN', 'DEVELOPER'), (req, res, next) =>
  timelogController.list(req, res).catch(next),
);

timelogRoutes.post(
  '/',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(timeLogSchema),
  (req, res, next) => timelogController.create(req, res).catch(next),
);

timelogRoutes.post(
  '/bulk-approve',
  requireRole('ADMIN'),
  validate(z.object({ ids: z.array(uuidSchema) })),
  (req, res, next) => timelogController.bulkApprove(req, res).catch(next),
);

timelogRoutes.post(
  '/bulk-reject',
  requireRole('ADMIN'),
  validate(z.object({ ids: z.array(uuidSchema) })),
  (req, res, next) => timelogController.bulkReject(req, res).catch(next),
);

timelogRoutes.patch(
  '/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  validate(updateTimeLogSchema),
  (req, res, next) => timelogController.update(req, res).catch(next),
);

timelogRoutes.delete(
  '/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  (req, res, next) => timelogController.remove(req, res).catch(next),
);

// Workflows
timelogRoutes.post(
  '/:id/submit',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  (req, res, next) => timelogController.submit(req, res).catch(next),
);

timelogRoutes.post(
  '/:id/approve',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  (req, res, next) => timelogController.approve(req, res).catch(next),
);

timelogRoutes.post(
  '/:id/reject',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  (req, res, next) => timelogController.reject(req, res).catch(next),
);

// Reports
timelogRoutes.get('/reports', requireRole('ADMIN', 'DEVELOPER'), (req, res, next) =>
  timelogController.getReports(req, res).catch(next),
);

// --- Timer (Stopwatch) Routes ---
timerRoutes.get('/active', requireRole('ADMIN', 'DEVELOPER'), (req, res, next) =>
  timelogController.activeTimer(req, res).catch(next),
);

timerRoutes.post(
  '/start',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(
    z.object({
      projectId: uuidSchema,
      taskId: uuidSchema.optional().nullable(),
      description: z.string().trim().min(1, 'Timer description is required'),
    }),
  ),
  (req, res, next) => timelogController.startTimer(req, res).catch(next),
);

timerRoutes.post('/stop', requireRole('ADMIN', 'DEVELOPER'), (req, res, next) =>
  timelogController.stopTimer(req, res).catch(next),
);
