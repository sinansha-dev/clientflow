import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateEmailLogInput {
  recipient: string;
  subject: string;
  provider: string;
  status: 'SENT' | 'FAILED';
  error?: string | null | undefined;
  sentAt?: Date | null | undefined;
  messageId?: string | null | undefined;
  attempts?: number | undefined;
}

export interface ListEmailLogsParams {
  recipient?: string | undefined;
  status?: string | undefined;
  provider?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export const emailLogRepository = {
  async createLog(input: CreateEmailLogInput) {
    return prisma.emailLog.create({
      data: {
        recipient: input.recipient,
        subject: input.subject,
        provider: input.provider,
        status: input.status,
        error: input.error || null,
        sentAt: input.sentAt || (input.status === 'SENT' ? new Date() : null),
        messageId: input.messageId || null,
        attempts: input.attempts || 1,
      },
    });
  },

  async updateStatus(
    id: string,
    status: 'SENT' | 'FAILED',
    error?: string | null,
    messageId?: string | null,
  ) {
    return prisma.emailLog.update({
      where: { id },
      data: {
        status,
        error: error || null,
        messageId: messageId || null,
        sentAt: status === 'SENT' ? new Date() : null,
      },
    });
  },

  async incrementAttempts(id: string) {
    return prisma.emailLog.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
      },
    });
  },

  async getById(id: string) {
    return prisma.emailLog.findUnique({
      where: { id },
    });
  },

  async listLogs(params: ListEmailLogsParams = {}) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.EmailLogWhereInput = {
      ...(params.recipient
        ? { recipient: { contains: params.recipient, mode: 'insensitive' } }
        : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.provider ? { provider: params.provider } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.emailLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },
};
