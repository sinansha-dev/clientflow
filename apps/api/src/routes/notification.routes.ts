import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

export const notificationRoutes = Router();

// Require authentication for all notification routes
notificationRoutes.use(requireAuth);

// Business / Internal Notification triggers
notificationRoutes.post('/', (req, res, next) =>
  notificationController.notify(req, res).catch(next),
);

notificationRoutes.post('/reminders', requireRole('ADMIN'), (req, res, next) =>
  notificationController.triggerReminders(req, res).catch(next),
);

// User notification management
notificationRoutes.get('/count', (req, res, next) =>
  notificationController.getUnreadCount(req, res).catch(next),
);

notificationRoutes.get('/unread', (req, res, next) =>
  notificationController.getUnreadNotifications(req, res).catch(next),
);

notificationRoutes.get('/', (req, res, next) =>
  notificationController.listUserNotifications(req, res).catch(next),
);

notificationRoutes.patch('/read-all', (req, res, next) =>
  notificationController.markAllAsRead(req, res).catch(next),
);

notificationRoutes.post('/bulk-read', (req, res, next) =>
  notificationController.bulkMarkAsRead(req, res).catch(next),
);

notificationRoutes.post('/bulk-delete', (req, res, next) =>
  notificationController.bulkDeleteRecipients(req, res).catch(next),
);

notificationRoutes.delete('/read', (req, res, next) =>
  notificationController.clearReadNotifications(req, res).catch(next),
);

notificationRoutes.get('/:id', (req, res, next) =>
  notificationController.getNotification(req, res).catch(next),
);

notificationRoutes.patch('/:id/read', (req, res, next) =>
  notificationController.markAsRead(req, res).catch(next),
);

notificationRoutes.patch('/:id/unread', (req, res, next) =>
  notificationController.markAsUnread(req, res).catch(next),
);

notificationRoutes.delete('/:id', (req, res, next) =>
  notificationController.deleteRecipient(req, res).catch(next),
);

notificationRoutes.patch('/:id/archive', (req, res, next) =>
  notificationController.archiveNotification(req, res).catch(next),
);

// Admin-only Email Admin & Debugging endpoints
notificationRoutes.post('/email/test', requireRole('ADMIN'), (req, res, next) =>
  notificationController.sendTestEmail(req, res).catch(next),
);

notificationRoutes.get('/email/logs', requireRole('ADMIN'), (req, res, next) =>
  notificationController.getEmailLogs(req, res).catch(next),
);

notificationRoutes.post('/email/logs/:id/retry', requireRole('ADMIN'), (req, res, next) =>
  notificationController.retryFailedEmail(req, res).catch(next),
);
