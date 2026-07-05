import { Router } from 'express';
import { z } from 'zod';
import { meetingController } from '../controllers/meeting.controller';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import {
  meetingSchema,
  calendarEventSchema,
  updateMeetingSchema,
  updateCalendarEventSchema,
  uuidSchema,
} from '@clientflow/shared';

export const meetingRoutes = Router();
export const calendarRoutes = Router();

const idParams = z.object({ id: uuidSchema });

meetingRoutes.use(requireAuth);
calendarRoutes.use(requireAuth);

// --- Meeting Routes ---
meetingRoutes.get('/', requireRole('ADMIN', 'DEVELOPER', 'CLIENT'), (req, res, next) =>
  meetingController.listMeetings(req, res).catch(next),
);

meetingRoutes.post(
  '/',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(meetingSchema),
  (req, res, next) => meetingController.createMeeting(req, res).catch(next),
);

meetingRoutes.get(
  '/:id',
  requireRole('ADMIN', 'DEVELOPER', 'CLIENT'),
  validate(idParams, 'params'),
  (req, res, next) => meetingController.getMeetingById(req, res).catch(next),
);

meetingRoutes.patch(
  '/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  validate(updateMeetingSchema),
  (req, res, next) => meetingController.updateMeeting(req, res).catch(next),
);

meetingRoutes.delete(
  '/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  (req, res, next) => meetingController.deleteMeeting(req, res).catch(next),
);

meetingRoutes.post(
  '/:id/rsvp',
  requireRole('ADMIN', 'DEVELOPER', 'CLIENT'),
  validate(idParams, 'params'),
  validate(z.object({ status: z.enum(['INVITED', 'ACCEPTED', 'DECLINED', 'ATTENDED']) })),
  (req, res, next) => meetingController.rsvp(req, res).catch(next),
);

// --- Calendar Routes ---
calendarRoutes.get('/events', requireRole('ADMIN', 'DEVELOPER'), (req, res, next) =>
  meetingController.listCalendarEvents(req, res).catch(next),
);

calendarRoutes.post(
  '/events',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(calendarEventSchema),
  (req, res, next) => meetingController.createCalendarEvent(req, res).catch(next),
);

calendarRoutes.patch(
  '/events/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  validate(updateCalendarEventSchema),
  (req, res, next) => meetingController.updateCalendarEvent(req, res).catch(next),
);

calendarRoutes.delete(
  '/events/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  (req, res, next) => meetingController.deleteCalendarEvent(req, res).catch(next),
);
