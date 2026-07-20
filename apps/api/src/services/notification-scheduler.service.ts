import { prisma } from '../config/prisma';
import { notificationService, NotificationEvents } from './notification.service';
import { logger } from '../utils/logger';

export const notificationSchedulerService = {
  /**
   * Scans and dispatches all scheduled business reminder notifications:
   * - AMC Expiring & Renewal Reminders
   * - Quotations Expiring Soon
   * - Overdue Invoices
   * - Tasks Due Tomorrow & Overdue Tasks
   * - Meeting Reminders
   */
  async runAllReminders() {
    logger.info('Starting scheduled notification reminder check...');
    const results = {
      amcReminders: await this.checkAmcReminders().catch((err) => {
        logger.error({ err }, 'AMC check error');
        return 0;
      }),
      quotationReminders: await this.checkExpiringQuotations().catch((err) => {
        logger.error({ err }, 'Quotation check error');
        return 0;
      }),
      overdueInvoices: await this.checkOverdueInvoices().catch((err) => {
        logger.error({ err }, 'Invoice check error');
        return 0;
      }),
      taskReminders: await this.checkTaskReminders().catch((err) => {
        logger.error({ err }, 'Task check error');
        return 0;
      }),
      meetingReminders: await this.checkMeetingReminders().catch((err) => {
        logger.error({ err }, 'Meeting check error');
        return 0;
      }),
    };
    logger.info({ results }, 'Scheduled notification reminder check completed.');
    return results;
  },

  /**
   * AMC Expiring & Renewal Reminders
   */
  async checkAmcReminders(): Promise<number> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const activeServices = await prisma.recurringService.findMany({
      where: {
        status: 'ACTIVE',
        nextInvoiceDate: { lte: thirtyDaysFromNow },
      },
      include: {
        project: {
          include: {
            client: true,
            projectManager: true,
          },
        },
      },
    });

    let count = 0;
    for (const service of activeServices) {
      const clientEmail = service.project?.client?.email;
      const managerId = service.project?.projectManagerId;
      const recipients: string[] = [];
      if (managerId) recipients.push(managerId);
      if (clientEmail) recipients.push(clientEmail);

      if (recipients.length > 0) {
        await notificationService.notifyEvent(
          NotificationEvents.AMC_EXPIRING,
          recipients,
          {
            amcName: service.name,
            amcAmount: service.amount,
            expiryDate: new Date(service.nextInvoiceDate).toLocaleDateString(),
            actionUrl: `http://localhost:5173/projects/${service.projectId}`,
            actionText: 'View AMC Contract',
          },
          { sendEmail: true, priority: 'HIGH' },
        );

        await notificationService.notifyEvent(
          NotificationEvents.AMC_RENEWAL_REMINDER,
          recipients,
          {
            amcName: service.name,
            amcAmount: service.amount,
            expiryDate: new Date(service.nextInvoiceDate).toLocaleDateString(),
            actionUrl: `http://localhost:5173/projects/${service.projectId}`,
            actionText: 'Renew AMC Service',
          },
          { sendEmail: true },
        );
        count += 2;
      }
    }
    return count;
  },

  /**
   * Quotations Expiring Soon (Valid until in 3 days)
   */
  async checkExpiringQuotations(): Promise<number> {
    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const quotes = await prisma.quotation.findMany({
      where: {
        status: { in: ['DRAFT', 'SENT'] },
        validUntil: { gte: now, lte: threeDaysLater },
        deletedAt: null,
      },
      include: { client: true },
    });

    let count = 0;
    for (const q of quotes) {
      const recipients: string[] = [q.createdBy];
      if (q.client?.email) recipients.push(q.client.email);

      await notificationService.notifyEvent(
        NotificationEvents.QUOTATION_EXPIRING_SOON,
        recipients,
        {
          quoteNumber: q.quoteNumber,
          quoteTotal: q.total,
          validUntil: new Date(q.validUntil).toLocaleDateString(),
          actionUrl: `http://localhost:5173/finance/quotations/${q.id}`,
          actionText: 'View Expiring Quotation',
        },
        { sendEmail: true },
      );
      count++;
    }
    return count;
  },

  /**
   * Overdue Invoices
   */
  async checkOverdueInvoices(): Promise<number> {
    const now = new Date();

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'OVERDUE', 'PARTIAL'] },
        dueDate: { lt: now },
        balanceDue: { gt: 0 },
        deletedAt: null,
      },
      include: { client: true },
    });

    let count = 0;
    for (const inv of overdueInvoices) {
      const recipients: string[] = [];
      if (inv.client?.email) recipients.push(inv.client.email);

      if (recipients.length > 0) {
        await notificationService.notifyEvent(
          NotificationEvents.INVOICE_OVERDUE,
          recipients,
          {
            invoiceNumber: inv.invoiceNumber,
            invoiceTotal: inv.total,
            balanceDue: inv.balanceDue,
            dueDate: new Date(inv.dueDate).toLocaleDateString(),
            actionUrl: `http://localhost:5173/finance/invoices/${inv.id}`,
            actionText: 'Pay Overdue Invoice',
          },
          { sendEmail: true, priority: 'HIGH' },
        );
        count++;
      }
    }
    return count;
  },

  /**
   * Tasks Due Tomorrow & Overdue Tasks
   */
  async checkTaskReminders(): Promise<number> {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pendingTasks = await prisma.task.findMany({
      where: {
        status: { notIn: ['DONE', 'COMPLETED'] },
        dueDate: { not: null },
        deletedAt: null,
      },
      include: {
        assignees: { select: { id: true } },
        project: { select: { projectName: true } },
      },
    });

    let count = 0;
    for (const t of pendingTasks) {
      if (!t.dueDate) continue;

      const assigneeIds = t.assignees.map((a) => a.id);
      if (assigneeIds.length === 0) continue;

      const isDueTomorrow = t.dueDate > now && t.dueDate <= tomorrow;
      const isOverdue = t.dueDate < now;

      if (isDueTomorrow) {
        await notificationService.notifyEvent(
          NotificationEvents.TASK_DUE_TOMORROW,
          assigneeIds,
          {
            taskTitle: t.title,
            taskStatus: t.status,
            taskPriority: t.priority,
            projectName: t.project?.projectName,
            dueDate: new Date(t.dueDate).toLocaleDateString(),
            actionUrl: `http://localhost:5173/tasks/${t.id}`,
            actionText: 'View Task Due Tomorrow',
          },
          { sendEmail: true },
        );
        count++;
      } else if (isOverdue) {
        await notificationService.notifyEvent(
          NotificationEvents.TASK_OVERDUE,
          assigneeIds,
          {
            taskTitle: t.title,
            taskStatus: t.status,
            taskPriority: t.priority,
            projectName: t.project?.projectName,
            dueDate: new Date(t.dueDate).toLocaleDateString(),
            actionUrl: `http://localhost:5173/tasks/${t.id}`,
            actionText: 'View Overdue Task',
          },
          { sendEmail: true, priority: 'HIGH' },
        );
        count++;
      }
    }
    return count;
  },

  /**
   * Meeting Reminders (Starting in next 1 hour)
   */
  async checkMeetingReminders(): Promise<number> {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    const upcomingMeetings = await prisma.meeting.findMany({
      where: {
        startTime: { gte: now, lte: oneHourLater },
      },
      include: {
        participants: { select: { userId: true } },
      },
    });

    let count = 0;
    for (const m of upcomingMeetings) {
      const participantUserIds = m.participants.map((p) => p.userId);
      const recipients = [...new Set([m.organizerId, ...participantUserIds])];

      await notificationService.notifyEvent(
        NotificationEvents.MEETING_REMINDER,
        recipients,
        {
          meetingTitle: m.title,
          meetingDate: new Date(m.startTime).toLocaleString(),
          meetingLink: m.meetingLink,
          actionUrl: m.meetingLink || `http://localhost:5173/meetings/${m.id}`,
          actionText: 'Join Meeting Now',
        },
        { sendEmail: true, priority: 'HIGH' },
      );
      count++;
    }
    return count;
  },
};
