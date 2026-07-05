import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const timelogRepository = {
  async list(params: {
    userId?: string;
    projectId?: string;
    taskId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { userId, projectId, taskId, status, startDate, endDate } = params;

    const where: Prisma.TimeLogWhereInput = {
      ...(userId && userId !== 'ALL' ? { userId } : {}),
      ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
      ...(taskId && taskId !== 'ALL' ? { taskId } : {}),
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(startDate || endDate
        ? {
            startTime: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    return prisma.timeLog.findMany({
      where,
      include: {
        project: { select: { projectName: true, projectCode: true } },
        task: { select: { title: true } },
        user: { select: { firstName: true, lastName: true, avatar: true } },
      },
      orderBy: { startTime: 'desc' },
    });
  },

  async findById(id: string) {
    return prisma.timeLog.findUnique({
      where: { id },
      include: {
        project: true,
        task: true,
        user: true,
      },
    });
  },

  // Stopwatch Timer Operations
  async getActiveTimer(userId: string) {
    return prisma.timeLog.findFirst({
      where: {
        userId,
        endTime: null,
      },
      include: {
        project: { select: { projectName: true, projectCode: true } },
        task: { select: { title: true } },
      },
    });
  },

  async startTimer(params: {
    userId: string;
    projectId: string;
    taskId?: string;
    description: string;
  }) {
    const { userId, projectId, taskId, description } = params;

    // Check if active timer already exists
    const active = await this.getActiveTimer(userId);
    if (active) {
      throw new Error('You already have an active timer running');
    }

    // Fetch user rate snapshot
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const hourlyRateSnapshot = user?.hourlyRate ?? 0;

    return prisma.timeLog.create({
      data: {
        userId,
        projectId,
        taskId: taskId || null,
        description,
        startTime: new Date(),
        hourlyRateSnapshot,
        status: 'DRAFT',
      },
    });
  },

  async stopTimer(userId: string) {
    const active = await this.getActiveTimer(userId);
    if (!active) {
      throw new Error('No active timer running');
    }

    const endTime = new Date();
    const diffMs = endTime.getTime() - new Date(active.startTime).getTime();
    const duration = Math.max(0.01, Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100); // round to 2 decimal places

    // Calculate actual hours for Task if linked
    if (active.taskId) {
      await prisma.task.update({
        where: { id: active.taskId },
        data: {
          actualHours: {
            increment: duration,
          },
        },
      });
    }

    return prisma.timeLog.update({
      where: { id: active.id },
      data: {
        endTime,
        duration,
        status: 'DRAFT', // Remains draft until submitted by user
      },
    });
  },

  // Manual Time Log Entry
  async createManualEntry(
    userId: string,
    data: {
      projectId: string;
      taskId?: string;
      description: string;
      startTime: string | Date;
      endTime: string | Date;
      billable?: boolean;
    },
  ) {
    const { projectId, taskId, description, startTime, endTime, billable = true } = data;

    const start = new Date(startTime);
    const end = new Date(endTime);

    // Overlap validation
    const overlap = await prisma.timeLog.findFirst({
      where: {
        userId,
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });

    if (overlap) {
      throw new Error('Time log entry overlaps with an existing time log');
    }

    const diffMs = end.getTime() - start.getTime();
    const duration = Math.max(0.01, Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const hourlyRateSnapshot = user?.hourlyRate ?? 0;

    // Update Task actual hours
    if (taskId) {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          actualHours: {
            increment: duration,
          },
        },
      });
    }

    return prisma.timeLog.create({
      data: {
        userId,
        projectId,
        taskId: taskId || null,
        description,
        startTime: start,
        endTime: end,
        duration,
        billable,
        hourlyRateSnapshot,
        status: 'DRAFT',
      },
    });
  },

  async update(id: string, data: Partial<Prisma.TimeLogUpdateInput>) {
    const entry = await prisma.timeLog.findUnique({ where: { id } });
    if (!entry) throw new Error('Time log not found');
    if (entry.status === 'APPROVED') {
      throw new Error('Approved timesheet logs are read-only');
    }

    // Recompute duration if times changed
    let updatedData = { ...data };
    if (data.startTime || data.endTime) {
      const start = new Date((data.startTime as string) || entry.startTime);
      const end = new Date((data.endTime as string) || entry.endTime || new Date());
      const diffMs = end.getTime() - start.getTime();
      updatedData.duration = Math.max(0.01, Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100);
    }

    return prisma.timeLog.update({
      where: { id },
      data: updatedData,
    });
  },

  async delete(id: string) {
    const entry = await prisma.timeLog.findUnique({ where: { id } });
    if (!entry) throw new Error('Time log not found');
    if (entry.status === 'APPROVED') {
      throw new Error('Approved time logs cannot be deleted');
    }
    return prisma.timeLog.delete({ where: { id } });
  },

  async submit(id: string) {
    return prisma.timeLog.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });
  },

  async approve(id: string) {
    return prisma.timeLog.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  },

  async reject(id: string) {
    return prisma.timeLog.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  },

  // Productivity analytics aggregation
  async getProductivityReport(params: {
    startDate?: string;
    endDate?: string;
    projectId?: string;
    userId?: string;
  }) {
    const { startDate, endDate, projectId, userId } = params;

    const where: Prisma.TimeLogWhereInput = {
      status: 'APPROVED',
      ...(userId ? { userId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(startDate || endDate
        ? {
            startTime: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const logs = await prisma.timeLog.findMany({ where });

    const totalHours = logs.reduce(
      (acc: number, log: { duration: number }) => acc + log.duration,
      0,
    );
    const billableHours = logs
      .filter((l: { billable: boolean }) => l.billable)
      .reduce((acc: number, log: { duration: number }) => acc + log.duration, 0);
    const nonBillableHours = totalHours - billableHours;
    const billableAmount = logs
      .filter((l: { billable: boolean }) => l.billable)
      .reduce(
        (acc: number, log: { duration: number; hourlyRateSnapshot: number }) =>
          acc + log.duration * log.hourlyRateSnapshot,
        0,
      );

    const productivity = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      billableHours: Math.round(billableHours * 100) / 100,
      nonBillableHours: Math.round(nonBillableHours * 100) / 100,
      productivityPercentage: productivity,
      billableAmount: Math.round(billableAmount * 100) / 100,
    };
  },
};
