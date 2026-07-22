import { Prisma, type NotificationPriority, type NotificationType } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateNotificationInput {
  type?: NotificationType | undefined;
  event: string;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue | undefined;
  priority?: NotificationPriority | undefined;
  status?: string | undefined;
  createdBy?: string | undefined;
  recipientUserIds: string[];
}

export interface ListNotificationsParams {
  userId: string;
  isRead?: boolean | undefined;
  isArchived?: boolean | undefined;
  type?: NotificationType | undefined;
  priority?: NotificationPriority | undefined;
  module?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export const notificationRepository = {
  async createNotification(input: CreateNotificationInput) {
    const {
      type = 'INFO',
      event,
      title,
      message,
      data,
      priority = 'NORMAL',
      status = 'PROCESSED',
      createdBy,
      recipientUserIds,
    } = input;

    return prisma.notification.create({
      data: {
        type,
        event,
        title,
        message,
        data: data ?? Prisma.JsonNull,
        priority,
        status,
        createdBy: createdBy || null,
        recipients: {
          create: recipientUserIds.map((userId) => ({
            userId,
          })),
        },
      },
      include: {
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  },

  async getById(id: string) {
    return prisma.notification.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  },

  async getUnreadCount(userId: string) {
    return prisma.notificationRecipient.count({
      where: {
        userId,
        isRead: false,
        isArchived: false,
      },
    });
  },

  async listForUser(params: ListNotificationsParams) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const skip = (page - 1) * limit;

    const andConditions: Prisma.NotificationRecipientWhereInput[] = [
      { userId: params.userId },
      { isArchived: params.isArchived ?? false },
    ];

    if (typeof params.isRead === 'boolean') {
      andConditions.push({ isRead: params.isRead });
    }

    const notificationFilter: Prisma.NotificationWhereInput = {};

    if (params.type) {
      notificationFilter.type = params.type;
    }

    if (params.priority) {
      notificationFilter.priority = params.priority;
    }

    if (params.module && params.module.toUpperCase() !== 'ALL') {
      const mod = params.module.toLowerCase();
      if (mod === 'crm') {
        notificationFilter.event = { startsWith: 'crm' };
      } else if (mod === 'projects' || mod === 'project') {
        notificationFilter.event = { startsWith: 'project' };
      } else if (mod === 'finance') {
        notificationFilter.OR = [
          { event: { startsWith: 'invoice' } },
          { event: { startsWith: 'quotation' } },
          { event: { startsWith: 'payment' } },
          { event: { startsWith: 'finance' } },
        ];
      } else if (mod === 'tasks' || mod === 'task') {
        notificationFilter.event = { startsWith: 'task' };
      } else if (mod === 'meetings' || mod === 'meeting') {
        notificationFilter.event = { startsWith: 'meeting' };
      } else if (mod === 'amc') {
        notificationFilter.event = { startsWith: 'amc' };
      } else if (mod === 'auth' || mod === 'authentication') {
        notificationFilter.event = { startsWith: 'auth' };
      } else {
        notificationFilter.event = { startsWith: mod };
      }
    }

    if (params.search && params.search.trim() !== '') {
      const q = params.search.trim();
      const searchOR: Prisma.NotificationWhereInput[] = [
        { title: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
        { event: { contains: q, mode: 'insensitive' } },
      ];
      if (notificationFilter.OR) {
        notificationFilter.AND = [{ OR: searchOR }];
      } else {
        notificationFilter.OR = searchOR;
      }
    }

    if (Object.keys(notificationFilter).length > 0) {
      andConditions.push({ notification: notificationFilter });
    }

    const where: Prisma.NotificationRecipientWhereInput = {
      AND: andConditions,
    };

    const [items, total] = await Promise.all([
      prisma.notificationRecipient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          notification: true,
        },
      }),
      prisma.notificationRecipient.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async markAsRead(recipientId: string, userId: string) {
    return prisma.notificationRecipient.updateMany({
      where: {
        id: recipientId,
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  },

  async markAsUnread(recipientId: string, userId: string) {
    return prisma.notificationRecipient.updateMany({
      where: {
        id: recipientId,
        userId,
      },
      data: {
        isRead: false,
        readAt: null,
      },
    });
  },

  async markAllAsRead(userId: string) {
    return prisma.notificationRecipient.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  },

  async bulkMarkAsRead(recipientIds: string[], userId: string) {
    return prisma.notificationRecipient.updateMany({
      where: {
        id: { in: recipientIds },
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  },

  async deleteRecipient(recipientId: string, userId: string) {
    return prisma.notificationRecipient.deleteMany({
      where: {
        id: recipientId,
        userId,
      },
    });
  },

  async bulkDeleteRecipients(recipientIds: string[], userId: string) {
    return prisma.notificationRecipient.deleteMany({
      where: {
        id: { in: recipientIds },
        userId,
      },
    });
  },

  async clearReadNotifications(userId: string) {
    return prisma.notificationRecipient.deleteMany({
      where: {
        userId,
        isRead: true,
      },
    });
  },

  async archiveNotification(recipientId: string, userId: string) {
    return prisma.notificationRecipient.updateMany({
      where: {
        id: recipientId,
        userId,
      },
      data: {
        isArchived: true,
      },
    });
  },

  async deleteNotification(id: string) {
    return prisma.notification.delete({
      where: { id },
    });
  },
};
