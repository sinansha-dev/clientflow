import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const taskRepository = {
  async list(params: {
    projectId?: string;
    assigneeId?: string;
    labelId?: string;
    status?: string;
    priority?: string;
    search?: string;
    overdue?: boolean;
    completed?: boolean;
    userId?: string; // Limit to assigned tasks if developer role
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      projectId,
      assigneeId,
      labelId,
      status,
      priority,
      search,
      overdue,
      completed,
      userId,
      sortBy = 'position',
      sortOrder = 'asc',
    } = params;

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(priority && priority !== 'ALL' ? { priority } : {}),
      ...(userId ? { assignees: { some: { id: userId } } } : {}),
      ...(assigneeId && assigneeId !== 'ALL' ? { assignees: { some: { id: assigneeId } } } : {}),
      ...(labelId && labelId !== 'ALL' ? { labels: { some: { id: labelId } } } : {}),
      ...(completed !== undefined
        ? completed
          ? { status: 'COMPLETED' }
          : { NOT: { status: 'COMPLETED' } }
        : {}),
      ...(overdue
        ? {
            status: { not: 'COMPLETED' },
            dueDate: { lt: new Date() },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return prisma.task.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            projectCode: true,
          },
        },
        assignees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        labels: true,
        checklist: true,
      },
      orderBy: { [sortBy]: sortOrder },
    });
  },

  async findById(id: string) {
    return prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            projectCode: true,
          },
        },
        assignees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        subtasks: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
        parentTask: {
          select: {
            id: true,
            title: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        checklist: {
          orderBy: { order: 'asc' },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { uploadedAt: 'desc' },
        },
        labels: true,
        activities: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },

  async create(
    data: Prisma.TaskUncheckedCreateInput & { assigneeIds?: string[]; labelIds?: string[] },
  ) {
    const { assigneeIds, labelIds, ...taskData } = data;

    // Find highest position in column to append at end
    const lastTask = await prisma.task.findFirst({
      where: {
        projectId: taskData.projectId,
        status: taskData.status || 'TODO',
        deletedAt: null,
      },
      orderBy: { position: 'desc' },
    });

    const position = lastTask ? lastTask.position + 1000 : 1000;

    return prisma.task.create({
      data: {
        ...taskData,
        position,
        ...(assigneeIds && assigneeIds.length > 0
          ? {
              assignees: {
                connect: assigneeIds.map((id) => ({ id })),
              },
            }
          : {}),
        ...(labelIds && labelIds.length > 0
          ? {
              labels: {
                connect: labelIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: {
        assignees: true,
        labels: true,
      },
    });
  },

  async update(
    id: string,
    data: Prisma.TaskUncheckedUpdateInput & { assigneeIds?: string[]; labelIds?: string[] },
  ) {
    const { assigneeIds, labelIds, ...taskData } = data;

    // Build connections/disconnections
    const updateData: Prisma.TaskUpdateInput = {
      ...taskData,
    };

    if (assigneeIds) {
      updateData.assignees = {
        set: assigneeIds.map((id) => ({ id })),
      };
    }

    if (labelIds) {
      updateData.labels = {
        set: labelIds.map((id) => ({ id })),
      };
    }

    if (taskData.status === 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (taskData.status && taskData.status !== 'COMPLETED') {
      updateData.completedAt = null;
    }

    return prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignees: true,
        labels: true,
      },
    });
  },

  async softDelete(id: string) {
    return prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  // Mid-point reordering for Kanban card move
  async moveTask(id: string, params: { status: string; prevTaskId?: string; nextTaskId?: string }) {
    const { status, prevTaskId, nextTaskId } = params;

    let position = 1000;

    if (prevTaskId && nextTaskId) {
      const [prevTask, nextTask] = await Promise.all([
        prisma.task.findUnique({ where: { id: prevTaskId } }),
        prisma.task.findUnique({ where: { id: nextTaskId } }),
      ]);
      if (prevTask && nextTask) {
        position = (prevTask.position + nextTask.position) / 2;
      }
    } else if (prevTaskId) {
      const prevTask = await prisma.task.findUnique({ where: { id: prevTaskId } });
      if (prevTask) {
        position = prevTask.position + 1000;
      }
    } else if (nextTaskId) {
      const nextTask = await prisma.task.findUnique({ where: { id: nextTaskId } });
      if (nextTask) {
        position = nextTask.position / 2;
      }
    }

    const updateData: Prisma.TaskUpdateInput = {
      status,
      position,
    };

    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }

    return prisma.task.update({
      where: { id },
      data: updateData,
    });
  },

  // Comments Operations
  async addComment(taskId: string, userId: string, comment: string) {
    return prisma.taskComment.create({
      data: {
        taskId,
        userId,
        comment,
      },
      include: {
        user: true,
      },
    });
  },

  async updateComment(id: string, comment: string) {
    return prisma.taskComment.update({
      where: { id },
      data: { comment, edited: true },
    });
  },

  async deleteComment(id: string) {
    return prisma.taskComment.delete({
      where: { id },
    });
  },

  async findCommentById(id: string) {
    return prisma.taskComment.findFirst({
      where: { id },
    });
  },

  // Checklist Operations
  async addChecklistItem(taskId: string, title: string) {
    const items = await prisma.taskChecklist.findMany({ where: { taskId } });
    const order = items.length > 0 ? Math.max(...items.map((i) => i.order)) + 1 : 0;

    return prisma.taskChecklist.create({
      data: {
        taskId,
        title,
        order,
      },
    });
  },

  async updateChecklistItem(id: string, data: { title?: string; completed?: boolean }) {
    return prisma.taskChecklist.update({
      where: { id },
      data,
    });
  },

  async deleteChecklistItem(id: string) {
    return prisma.taskChecklist.delete({
      where: { id },
    });
  },

  async findChecklistItemById(id: string) {
    return prisma.taskChecklist.findFirst({
      where: { id },
    });
  },

  // Attachments Operations
  async addAttachment(
    taskId: string,
    file: { name: string; url: string; size: number; uploadedById: string },
  ) {
    return prisma.taskAttachment.create({
      data: {
        taskId,
        ...file,
      },
      include: {
        uploadedBy: true,
      },
    });
  },

  async deleteAttachment(id: string) {
    return prisma.taskAttachment.delete({
      where: { id },
    });
  },

  async findAttachmentById(id: string) {
    return prisma.taskAttachment.findFirst({
      where: { id },
    });
  },

  // Labels Operations
  async listLabels() {
    return prisma.taskLabel.findMany({
      orderBy: { name: 'asc' },
    });
  },

  async createLabel(name: string, color: string) {
    return prisma.taskLabel.upsert({
      where: { name },
      update: { color },
      create: { name, color },
    });
  },

  async deleteLabel(id: string) {
    return prisma.taskLabel.delete({
      where: { id },
    });
  },

  async findLabelById(id: string) {
    return prisma.taskLabel.findFirst({
      where: { id },
    });
  },

  // Activity log audits
  async logActivity(taskId: string, type: string, description: string) {
    return prisma.taskActivity.create({
      data: {
        taskId,
        type,
        description,
      },
    });
  },
};
