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

  async listForUser(params: ListNotificationsParams) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationRecipientWhereInput = {
      userId: params.userId,
      ...(typeof params.isRead === 'boolean' ? { isRead: params.isRead } : {}),
      isArchived: params.isArchived ?? false,
      ...(params.type ? { notification: { type: params.type } } : {}),
      ...(params.priority ? { notification: { priority: params.priority } } : {}),
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
