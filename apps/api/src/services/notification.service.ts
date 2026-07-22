import type {
  NotificationPriority,
  NotificationType,
  NotifyPayload,
  NotifyResult,
  SendEmailResult,
} from '@clientflow/types';
import { prisma } from '../config/prisma';
import { notificationRepository } from '../repositories/notification.repository';
import { notificationPreferenceRepository } from '../repositories/notification-preference.repository';
import { emailQueueService } from './email-queue.service';
import { emailService } from './email.service';
import { emailTemplateEngine, type EmailTemplateData } from './email/email-template.engine';
import { logger } from '../utils/logger';

export const NotificationEvents = {
  // Authentication
  AUTH_USER_INVITED: 'auth.user.invited',
  AUTH_WELCOME: 'auth.welcome',
  AUTH_PASSWORD_RESET: 'auth.password.reset',
  AUTH_PASSWORD_CHANGED: 'auth.password.changed',
  AUTH_EMAIL_CHANGED: 'auth.email.changed',
  AUTH_ACCOUNT_ACTIVATED: 'auth.account.activated',
  AUTH_ACCOUNT_LOCKED: 'auth.account.locked',

  // CRM
  CRM_LEAD_ASSIGNED: 'crm.lead.assigned',
  CRM_LEAD_CONVERTED: 'crm.lead.converted',
  CRM_CLIENT_INVITATION: 'crm.client.invitation',
  CRM_CLIENT_STATUS_UPDATED: 'crm.client.status_updated',

  // Projects
  PROJECT_CREATED: 'project.created',
  PROJECT_ASSIGNED: 'project.assigned',
  PROJECT_COMPLETED: 'project.completed',
  PROJECT_CANCELLED: 'project.cancelled',

  // Quotations
  QUOTATION_CREATED: 'quotation.created',
  QUOTATION_SENT: 'quotation.sent',
  QUOTATION_APPROVED: 'quotation.approved',
  QUOTATION_REJECTED: 'quotation.rejected',
  QUOTATION_EXPIRING_SOON: 'quotation.expiring_soon',

  // Finance
  INVOICE_SENT: 'invoice.sent',
  INVOICE_OVERDUE: 'invoice.overdue',
  INVOICE_PAID: 'invoice.paid',
  PAYMENT_REMINDER: 'payment.reminder',
  PAYMENT_RECEIVED: 'payment.received',
  RECURRING_INVOICE_GENERATED: 'recurring.invoice.generated',

  // Tasks
  TASK_ASSIGNED: 'task.assigned',
  TASK_UPDATED: 'task.updated',
  TASK_COMPLETED: 'task.completed',
  TASK_DUE_TOMORROW: 'task.due_tomorrow',
  TASK_OVERDUE: 'task.overdue',

  // Meetings
  MEETING_SCHEDULED: 'meeting.scheduled',
  MEETING_REMINDER: 'meeting.reminder',
  MEETING_CANCELLED: 'meeting.cancelled',

  // AMC
  AMC_EXPIRING: 'amc.expiring',
  AMC_RENEWAL_REMINDER: 'amc.renewal_reminder',

  // General
  SYSTEM_ANNOUNCEMENT: 'system.announcement',
} as const;

export const notificationService = {
  /**
   * High-level business event notification entry point.
   * Renders email template using template engine and dispatches notification.
   */
  async notifyEvent(
    event: string,
    recipients: string[],
    data: EmailTemplateData = {},
    options: Partial<NotifyPayload> = {},
  ): Promise<NotifyResult> {
    const rendered = emailTemplateEngine.render(event, data);

    const title = options.title || rendered.subject;
    const message = options.message || data.customMessage || rendered.subject;

    return this.notify({
      event,
      title,
      message,
      type: options.type || this.getDefaultType(event),
      priority: options.priority || this.getDefaultPriority(event),
      data: data as Record<string, any>,
      recipients,
      createdBy: options.createdBy,
      sendEmail: options.sendEmail ?? true,
      emailOptions: {
        subject: options.emailOptions?.subject || rendered.subject,
        html: options.emailOptions?.html || rendered.html,
        text: options.emailOptions?.text || rendered.text,
        attachments: options.emailOptions?.attachments,
      },
    });
  },

  /**
   * Main notification entrypoint. Business modules call this method.
   * Isolates failures so notification issues never crash business operations.
   */
  async notify(payload: NotifyPayload): Promise<NotifyResult> {
    const errors: string[] = [];
    const emailResults: SendEmailResult[] = [];
    let notificationId: string | undefined;

    try {
      const {
        event,
        title,
        message,
        type = 'INFO',
        priority = 'NORMAL',
        data,
        recipients,
        createdBy,
        sendEmail = false,
        emailOptions,
      } = payload;

      if (!event || !title || !message) {
        throw new Error('Notification payload requires event, title, and message');
      }

      if (!recipients || recipients.length === 0) {
        logger.warn({ event }, 'Notification trigger skipped: no recipients specified');
        return {
          success: true,
          recipientCount: 0,
          errors: ['No recipients provided'],
        };
      }

      // Resolve recipient user IDs and email addresses
      const resolvedRecipients = await this.resolveRecipients(recipients);

      if (resolvedRecipients.userIds.length === 0 && resolvedRecipients.emails.length === 0) {
        logger.warn(
          { recipients, event },
          'Could not resolve valid user accounts or email addresses for notification',
        );
        return {
          success: false,
          recipientCount: 0,
          errors: ['Could not resolve valid recipient users or emails'],
        };
      }

      // 1. Create In-App Notification database records if recipient User IDs exist
      if (resolvedRecipients.userIds.length > 0) {
        try {
          const createInput: Parameters<typeof notificationRepository.createNotification>[0] = {
            type: type as any,
            event,
            title,
            message,
            priority: priority as any,
            status: 'PROCESSED',
            recipientUserIds: resolvedRecipients.userIds,
          };
          if (data !== undefined) createInput.data = data;
          if (createdBy !== undefined) createInput.createdBy = createdBy;

          const dbNotification = await notificationRepository.createNotification(createInput);
          notificationId = dbNotification.id;

          logger.info(
            { notificationId, event, recipientCount: resolvedRecipients.userIds.length },
            'In-App Notification records created successfully',
          );
        } catch (dbErr: any) {
          const dbErrorMsg = `Failed to save DB notification: ${dbErr?.message || dbErr}`;
          logger.error({ error: dbErrorMsg, event }, 'Database notification error');
          errors.push(dbErrorMsg);
        }
      }

      // 2. Process Email delivery if requested or for HIGH/CRITICAL priorities
      const shouldEmail = sendEmail || priority === 'HIGH' || priority === 'CRITICAL';

      if (shouldEmail) {
        const emailTargets: Array<{ email: string; userId?: string }> = [];

        for (const user of resolvedRecipients.userObjects) {
          try {
            const pref = await notificationPreferenceRepository.getByUserId(user.id);
            if (!pref || pref.emailEnabled) {
              emailTargets.push({ email: user.email, userId: user.id });
            } else {
              logger.info(
                { userId: user.id, email: user.email },
                'Skipped email notification per user preference',
              );
            }
          } catch (prefErr) {
            emailTargets.push({ email: user.email, userId: user.id });
          }
        }

        // Add any standalone email recipients
        for (const rawEmail of resolvedRecipients.emails) {
          if (!emailTargets.some((t) => t.email.toLowerCase() === rawEmail.toLowerCase())) {
            emailTargets.push({ email: rawEmail });
          }
        }

        // If template html/text wasn't passed in emailOptions, render template using template engine
        let subject = emailOptions?.subject;
        let htmlContent = emailOptions?.html;
        let textContent = emailOptions?.text;

        if (!htmlContent || !subject) {
          const rendered = emailTemplateEngine.render(event, {
            ...(data || {}),
            customMessage: message,
          });
          if (!subject) subject = rendered.subject;
          if (!htmlContent) htmlContent = rendered.html;
          if (!textContent) textContent = rendered.text;
        }

        if (!subject) subject = title;
        if (!textContent) textContent = `${title}\n\n${message}`;

        for (const target of emailTargets) {
          try {
            emailQueueService.enqueue({
              recipient: target.email,
              subject,
              html: htmlContent,
              text: textContent,
              attachments: emailOptions?.attachments,
              priority: priority as any,
              event,
            });
          } catch (mailErr: any) {
            const mailErrorMsg = `Email queueing exception for ${target.email}: ${mailErr?.message || mailErr}`;
            logger.error({ error: mailErrorMsg, recipient: target.email }, 'Email queue error');
            errors.push(mailErrorMsg);
          }
        }
      }

      const res: NotifyResult = {
        success: errors.length === 0,
        recipientCount: resolvedRecipients.userIds.length + resolvedRecipients.emails.length,
      };
      if (notificationId !== undefined) res.notificationId = notificationId;
      if (emailResults.length > 0) res.emailLogs = emailResults;
      if (errors.length > 0) res.errors = errors;

      return res;
    } catch (criticalErr: any) {
      const topErrorMsg = criticalErr?.message || 'Unhandled error in NotificationService.notify';
      logger.error(
        { error: topErrorMsg, payload },
        'Critical NotificationService exception isolated',
      );
      return {
        success: false,
        recipientCount: 0,
        errors: [topErrorMsg],
      };
    }
  },

  /**
   * Helper method to resolve string identifiers into user IDs, User objects, and raw email addresses.
   */
  async resolveRecipients(recipients: string[]) {
    const userIds: string[] = [];
    const emails: string[] = [];
    const userObjects: Array<{ id: string; email: string }> = [];

    const isUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

    const targetUuids = recipients.filter(isUuid);
    const targetEmails = recipients.filter(isEmail);

    if (targetUuids.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          id: { in: targetUuids },
          deletedAt: null,
        },
        select: { id: true, email: true },
      });

      for (const u of users) {
        userIds.push(u.id);
        userObjects.push(u);
      }
    }

    if (targetEmails.length > 0) {
      const usersByEmail = await prisma.user.findMany({
        where: {
          email: { in: targetEmails },
          deletedAt: null,
        },
        select: { id: true, email: true },
      });

      for (const u of usersByEmail) {
        if (!userIds.includes(u.id)) {
          userIds.push(u.id);
          userObjects.push(u);
        }
      }

      // Track emails that do not correspond to registered users
      const foundEmails = new Set(usersByEmail.map((u) => u.email.toLowerCase()));
      for (const email of targetEmails) {
        if (!foundEmails.has(email.toLowerCase())) {
          emails.push(email);
        }
      }
    }

    return { userIds, emails, userObjects };
  },

  getDefaultType(event: string): NotificationType {
    if (
      event.includes('overdue') ||
      event.includes('cancelled') ||
      event.includes('rejected') ||
      event.includes('locked')
    ) {
      return 'WARNING';
    }
    if (
      event.includes('paid') ||
      event.includes('completed') ||
      event.includes('approved') ||
      event.includes('welcome') ||
      event.includes('activated')
    ) {
      return 'SUCCESS';
    }
    return 'INFO';
  },

  getDefaultPriority(event: string): NotificationPriority {
    if (event.includes('overdue') || event.includes('reset') || event.includes('locked')) {
      return 'HIGH';
    }
    return 'NORMAL';
  },
};
