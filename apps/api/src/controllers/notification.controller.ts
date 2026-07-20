import type { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';
import { notificationRepository } from '../repositories/notification.repository';
import { emailService } from '../services/email.service';
import { emailLogRepository } from '../repositories/email-log.repository';
import { notificationSchedulerService } from '../services/notification-scheduler.service';
import { ok } from '../utils/http';
import { forbidden, notFound } from '../utils/errors';

export const notificationController = {
  async notify(req: Request, res: Response) {
    const payload = req.body;
    const createdBy = req.user?.id;

    const result = await notificationService.notify({
      ...payload,
      createdBy: payload.createdBy || createdBy,
    });

    return ok(res, 'Notification process triggered', result, 201);
  },

  async triggerReminders(_req: Request, res: Response) {
    const results = await notificationSchedulerService.runAllReminders();
    return ok(res, 'Scheduled reminder notifications processed successfully', results);
  },

  async listUserNotifications(req: Request, res: Response) {
    const userId = req.user!.id;
    const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;
    const isArchived = req.query.isArchived !== undefined ? req.query.isArchived === 'true' : false;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const params: Parameters<typeof notificationRepository.listForUser>[0] = {
      userId,
      isArchived,
      page,
      limit,
    };
    if (isRead !== undefined) params.isRead = isRead;

    const result = await notificationRepository.listForUser(params);

    return ok(res, 'Notifications retrieved', result);
  },

  async getNotification(req: Request, res: Response) {
    const id = req.params.id || '';
    if (!id) throw notFound('Notification ID required');

    const notification = await notificationRepository.getById(id);

    if (!notification) {
      throw notFound('Notification not found');
    }

    if (req.user!.role !== 'ADMIN') {
      const isRecipient = notification.recipients.some((r) => r.userId === req.user!.id);
      if (!isRecipient) {
        throw forbidden('Access denied to this notification');
      }
    }

    return ok(res, 'Notification retrieved', notification);
  },

  async markAsRead(req: Request, res: Response) {
    const recipientId = req.params.id || '';
    if (!recipientId) throw notFound('Recipient ID required');
    const userId = req.user!.id;

    await notificationRepository.markAsRead(recipientId, userId);
    return ok(res, 'Notification marked as read');
  },

  async markAllAsRead(req: Request, res: Response) {
    const userId = req.user!.id;
    await notificationRepository.markAllAsRead(userId);
    return ok(res, 'All notifications marked as read');
  },

  async archiveNotification(req: Request, res: Response) {
    const recipientId = req.params.id || '';
    if (!recipientId) throw notFound('Recipient ID required');
    const userId = req.user!.id;

    await notificationRepository.archiveNotification(recipientId, userId);
    return ok(res, 'Notification archived');
  },

  async sendTestEmail(req: Request, res: Response) {
    const { toEmail } = req.body;
    const targetEmail = toEmail || req.user!.email;

    const result = await emailService.testEmail(targetEmail);
    return ok(res, 'Test email operation completed', result);
  },

  async getEmailLogs(req: Request, res: Response) {
    const recipient = req.query.recipient as string | undefined;
    const status = req.query.status as string | undefined;
    const provider = req.query.provider as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const queryParams: Parameters<typeof emailLogRepository.listLogs>[0] = {
      page,
      limit,
    };
    if (recipient !== undefined) queryParams.recipient = recipient;
    if (status !== undefined) queryParams.status = status;
    if (provider !== undefined) queryParams.provider = provider;

    const result = await emailLogRepository.listLogs(queryParams);

    return ok(res, 'Email logs retrieved', result);
  },

  async retryFailedEmail(req: Request, res: Response) {
    const logId = req.params.id || '';
    if (!logId) throw notFound('Email Log ID required');
    const result = await emailService.retryFailedEmail(logId);
    return ok(res, 'Email retry operation completed', result);
  },
};
