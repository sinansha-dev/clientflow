import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

const roundHours = (value: number) => Math.round(value * 100) / 100;

async function syncProjectActualHours(projectId: string) {
  const logs = await prisma.timeLog.findMany({
    where: { projectId, status: 'APPROVED', endTime: { not: null } },
    select: { duration: true },
  });
  const actualHours = roundHours(logs.reduce((sum, log) => sum + log.duration, 0));
  await prisma.project.update({ where: { id: projectId }, data: { actualHours } });
}

async function syncTaskActualHours(taskId?: string | null) {
  if (!taskId) return;
  const logs = await prisma.timeLog.findMany({
    where: { taskId, status: 'APPROVED', endTime: { not: null } },
    select: { duration: true },
  });
  const actualHours = roundHours(logs.reduce((sum, log) => sum + log.duration, 0));
  await prisma.task.update({ where: { id: taskId }, data: { actualHours } });
}

async function syncTimeTargets(projectId: string, taskId?: string | null) {
  await Promise.all([syncProjectActualHours(projectId), syncTaskActualHours(taskId)]);
}

const listInclude = {
  project: {
    select: {
      id: true,
      projectName: true,
      projectCode: true,
      clientId: true,
      client: { select: { id: true, companyName: true } },
    },
  },
  task: { select: { id: true, title: true } },
  user: { select: { id: true, firstName: true, lastName: true, avatar: true, hourlyRate: true } },
} satisfies Prisma.TimeLogInclude;

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
      include: listInclude,
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

  async getActiveTimer(userId: string) {
    return prisma.timeLog.findFirst({
      where: {
        userId,
        endTime: null,
      },
      include: listInclude,
    });
  },

  async startTimer(params: {
    userId: string;
    projectId: string;
    taskId?: string;
    description: string;
  }) {
    const { userId, projectId, taskId, description } = params;

    const active = await this.getActiveTimer(userId);
    if (active) {
      throw new Error('You already have an active timer running');
    }

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
      include: listInclude,
    });
  },

  async stopTimer(userId: string) {
    const active = await this.getActiveTimer(userId);
    if (!active) {
      throw new Error('No active timer running');
    }

    const endTime = new Date();
    const diffMs = endTime.getTime() - new Date(active.startTime).getTime();
    const duration = Math.max(0.01, roundHours(diffMs / (1000 * 60 * 60)));

    const updated = await prisma.timeLog.update({
      where: { id: active.id },
      data: {
        endTime,
        duration,
        status: 'DRAFT',
      },
      include: listInclude,
    });
    await syncTimeTargets(updated.projectId, updated.taskId);
    return updated;
  },

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
    const duration = Math.max(0.01, roundHours(diffMs / (1000 * 60 * 60)));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const hourlyRateSnapshot = user?.hourlyRate ?? 0;

    const created = await prisma.timeLog.create({
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
      include: listInclude,
    });
    await syncTimeTargets(projectId, taskId || null);
    return created;
  },

  async update(id: string, data: Partial<Prisma.TimeLogUpdateInput>) {
    const entry = await prisma.timeLog.findUnique({ where: { id } });
    if (!entry) throw new Error('Time log not found');
    if (entry.status === 'APPROVED') {
      throw new Error('Approved timesheet logs are read-only');
    }

    const updatedData: Prisma.TimeLogUpdateInput = { ...data };
    if (data.startTime || data.endTime) {
      const start = new Date((data.startTime as string) || entry.startTime);
      const end = new Date((data.endTime as string) || entry.endTime || new Date());
      const diffMs = end.getTime() - start.getTime();
      updatedData.duration = Math.max(0.01, roundHours(diffMs / (1000 * 60 * 60)));
    }

    const updated = await prisma.timeLog.update({
      where: { id },
      data: updatedData,
      include: listInclude,
    });
    await syncTimeTargets(entry.projectId, entry.taskId);
    if (updated.projectId !== entry.projectId) {
      await syncProjectActualHours(updated.projectId);
    }
    if (updated.taskId !== entry.taskId) {
      await syncTaskActualHours(updated.taskId);
    }
    return updated;
  },

  async delete(id: string) {
    const entry = await prisma.timeLog.findUnique({ where: { id } });
    if (!entry) throw new Error('Time log not found');
    if (entry.status === 'APPROVED') {
      throw new Error('Approved time logs cannot be deleted');
    }
    const deleted = await prisma.timeLog.delete({ where: { id } });
    await syncTimeTargets(entry.projectId, entry.taskId);
    return deleted;
  },

  async submit(id: string) {
    const updated = await prisma.timeLog.update({
      where: { id },
      data: { status: 'SUBMITTED' },
      include: listInclude,
    });
    await syncTimeTargets(updated.projectId, updated.taskId);
    return updated;
  },

  async approve(id: string) {
    const updated = await prisma.timeLog.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: listInclude,
    });
    await syncTimeTargets(updated.projectId, updated.taskId);
    return updated;
  },

  async reject(id: string) {
    const updated = await prisma.timeLog.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: listInclude,
    });
    await syncTimeTargets(updated.projectId, updated.taskId);
    return updated;
  },

  async bulkApprove(ids: string[]) {
    const logs = await prisma.timeLog.findMany({
      where: { id: { in: ids }, status: 'SUBMITTED' },
      select: { id: true, projectId: true, taskId: true },
    });
    if (logs.length === 0) return { count: 0 };

    const updated = await prisma.timeLog.updateMany({
      where: { id: { in: logs.map((l) => l.id) } },
      data: { status: 'APPROVED' },
    });

    const projectIds = Array.from(new Set(logs.map((l) => l.projectId)));
    const taskIds = Array.from(new Set(logs.map((l) => l.taskId).filter(Boolean))) as string[];

    await Promise.all([
      ...projectIds.map((pid) => syncProjectActualHours(pid)),
      ...taskIds.map((tid) => syncTaskActualHours(tid)),
    ]);

    return updated;
  },

  async bulkReject(ids: string[]) {
    const logs = await prisma.timeLog.findMany({
      where: { id: { in: ids }, status: 'SUBMITTED' },
      select: { id: true, projectId: true, taskId: true },
    });
    if (logs.length === 0) return { count: 0 };

    const updated = await prisma.timeLog.updateMany({
      where: { id: { in: logs.map((l) => l.id) } },
      data: { status: 'REJECTED' },
    });

    const projectIds = Array.from(new Set(logs.map((l) => l.projectId)));
    const taskIds = Array.from(new Set(logs.map((l) => l.taskId).filter(Boolean))) as string[];

    await Promise.all([
      ...projectIds.map((pid) => syncProjectActualHours(pid)),
      ...taskIds.map((tid) => syncTaskActualHours(tid)),
    ]);

    return updated;
  },

  async getProductivityReport(params: {
    startDate?: string;
    endDate?: string;
    projectId?: string;
    userId?: string;
  }) {
    const { startDate, endDate, projectId, userId } = params;

    const where: Prisma.TimeLogWhereInput = {
      status: 'APPROVED',
      endTime: { not: null },
      ...(userId && userId !== 'ALL' ? { userId } : {}),
      ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
      ...(startDate || endDate
        ? {
            startTime: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const logs = await prisma.timeLog.findMany({
      where,
      include: {
        project: {
          select: { id: true, projectName: true, client: { select: { companyName: true } } },
        },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const totalHours = logs.reduce((acc, log) => acc + log.duration, 0);
    const billableHours = logs
      .filter((log) => log.billable)
      .reduce((acc, log) => acc + log.duration, 0);
    const nonBillableHours = totalHours - billableHours;
    const billableAmount = logs
      .filter((log) => log.billable)
      .reduce((acc, log) => acc + log.duration * log.hourlyRateSnapshot, 0);

    const productivity = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;

    const breakdownMap = logs.reduce(
      (map, log) => {
        const current = map.get(log.projectId) ?? {
          projectId: log.projectId,
          projectName: log.project?.projectName ?? 'Unknown project',
          clientName: log.project?.client?.companyName ?? 'No client',
          hours: 0,
          billableHours: 0,
          billableAmount: 0,
        };
        current.hours += log.duration;
        if (log.billable) {
          current.billableHours += log.duration;
          current.billableAmount += log.duration * log.hourlyRateSnapshot;
        }
        map.set(log.projectId, current);
        return map;
      },
      new Map<
        string,
        {
          projectId: string;
          projectName: string;
          clientName: string;
          hours: number;
          billableHours: number;
          billableAmount: number;
        }
      >(),
    );

    const projectBreakdown = Array.from(breakdownMap.values()).map((item) => ({
      ...item,
      hours: roundHours(item.hours),
      billableHours: roundHours(item.billableHours),
      billableAmount: Math.round(item.billableAmount * 100) / 100,
    }));
    return {
      totalHours: roundHours(totalHours),
      billableHours: roundHours(billableHours),
      nonBillableHours: roundHours(nonBillableHours),
      productivityPercentage: productivity,
      billableAmount: Math.round(billableAmount * 100) / 100,
      projectBreakdown,
    };
  },
};
