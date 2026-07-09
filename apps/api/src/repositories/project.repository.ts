import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

type ProjectHealthInput = {
  milestones?: Array<{ status: string; dueDate: string | Date }>;
  deadline: string | Date;
  progress: number;
  status: string;
};

export const projectRepository = {
  // Compute health status dynamically
  computeHealth(project: ProjectHealthInput): 'HEALTHY' | 'AT_RISK' | 'DELAYED' {
    const now = new Date();

    // 1. Check for overdue milestones
    const milestones = project.milestones ?? [];
    const hasOverdueMilestones = milestones.some(
      (milestone) => milestone.status !== 'COMPLETED' && new Date(milestone.dueDate) < now,
    );
    if (hasOverdueMilestones) {
      return 'DELAYED';
    }

    // 2. Check for deadline proximity
    const deadline = new Date(project.deadline);
    const timeDiff = deadline.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 7 && project.progress < 60 && project.status !== 'COMPLETED') {
      return 'AT_RISK';
    }

    return 'HEALTHY';
  },

  async list(params: {
    search?: string;
    status?: string;
    priority?: string;
    health?: string;
    clientId?: string;
    managerId?: string;
    userId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    const {
      search,
      status,
      priority,
      health,
      clientId,
      managerId,
      userId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(priority && priority !== 'ALL' ? { priority } : {}),
      ...(clientId && clientId !== 'ALL' ? { clientId } : {}),
      ...(managerId && managerId !== 'ALL' ? { projectManagerId: managerId } : {}),
      ...(userId ? { teamMembers: { some: { userId } } } : {}),
      ...(search
        ? {
            OR: [
              { projectName: { contains: search, mode: 'insensitive' } },
              { projectCode: { contains: search, mode: 'insensitive' } },
              {
                client: {
                  companyName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                projectManager: {
                  OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    // Get all projects matching filters (except health since it's computed dynamically)
    let projects = await prisma.project.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
            companyLogo: true,
          },
        },
        projectManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        teamMembers: true,
        milestones: true,
        activities: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { [sortBy]: sortOrder },
    });

    // Compute health status and filter by health if requested
    projects = projects.map((p) => {
      const computed = this.computeHealth(p);
      return { ...p, healthStatus: computed };
    });

    if (health && health !== 'ALL') {
      projects = projects.filter((p) => p.healthStatus === health);
    }

    const total = projects.length;
    const items = projects.slice(skip, skip + limit);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  },

  async findById(id: string) {
    const project = await prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
            companyLogo: true,
            email: true,
            phone: true,
          },
        },
        projectManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        teamMembers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                hourlyRate: true,
              },
            },
          },
        },
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
        notes: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                hourlyRate: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        files: {
          orderBy: { createdAt: 'desc' },
        },
        meetings: {
          orderBy: { date: 'desc' },
        },
        meetingsLinked: {
          include: {
            organizer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                hourlyRate: true,
              },
            },
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                  },
                },
              },
            },
          },
          orderBy: { startTime: 'desc' },
        },
        timeLogs: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                hourlyRate: true,
              },
            },
            task: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: { startTime: 'desc' },
        },
        deployments: {
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          where: { deletedAt: null },
          include: { client: true, payments: true },
          orderBy: { createdAt: 'desc' },
        },
        quotations: {
          where: { deletedAt: null },
          include: { client: true, items: true },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) return null;

    // Compute and return computed health
    const computedHealth = this.computeHealth(project);
    return {
      ...project,
      healthStatus: computedHealth,
    };
  },

  async create(
    data: Prisma.ProjectCreateInput & {
      teamMembersInput?: Array<{ userId: string; role: string }>;
    },
  ) {
    // Generate unique project code CF-XXXXXX
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const projectCode = `CF-${randomSuffix}`;

    const { teamMembersInput, ...projectData } = data;

    const project = await prisma.project.create({
      data: {
        ...projectData,
        projectCode,
      },
    });

    // Automatically add Project Manager to project team
    await prisma.projectTeam.create({
      data: {
        projectId: project.id,
        userId: project.projectManagerId,
        role: 'Project Manager',
      },
    });

    // Add additional team members if provided
    if (teamMembersInput && teamMembersInput.length > 0) {
      await Promise.all(
        teamMembersInput
          .filter((tm) => tm.userId !== project.projectManagerId) // Avoid PM duplicate
          .map((tm) =>
            prisma.projectTeam.create({
              data: {
                projectId: project.id,
                userId: tm.userId,
                role: tm.role,
              },
            }),
          ),
      );
    }

    return project;
  },

  async update(id: string, data: Prisma.ProjectUpdateInput) {
    // Recalculate progress if milestones are completed (done in milestones mutate, but this handles direct project updates)
    const updated = await prisma.project.update({
      where: { id },
      data,
    });
    await this.recalculateProgress(id);
    return prisma.project.findUnique({ where: { id } }) || updated;
  },

  async archive(id: string) {
    const updated = await prisma.project.update({
      where: { id },
      data: { status: 'COMPLETED', archivedAt: new Date(), progress: 100 },
    });
    return updated;
  },

  async restore(id: string) {
    const updated = await prisma.project.update({
      where: { id },
      data: { status: 'PLANNING', archivedAt: null },
    });
    await this.recalculateProgress(id);
    return prisma.project.findUnique({ where: { id } }) || updated;
  },

  async softDelete(id: string) {
    const updatedProject = await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Cascade soft-delete to project tasks
    const tasks = await prisma.task.findMany({
      where: { projectId: id, deletedAt: null },
      select: { id: true },
    });

    const { taskRepository } = require('./task.repository');
    for (const task of tasks) {
      await taskRepository.softDelete(task.id);
    }

    return updatedProject;
  },

  // Team Management
  async addTeamMember(projectId: string, userId: string, role: string) {
    return prisma.projectTeam.upsert({
      where: {
        projectId_userId: { projectId, userId },
      },
      update: { role },
      create: { projectId, userId, role },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
  },

  async removeTeamMember(projectId: string, userId: string) {
    return prisma.projectTeam.delete({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
  },

  async updateTeamMemberRole(projectId: string, userId: string, role: string) {
    return prisma.projectTeam.update({
      where: {
        projectId_userId: { projectId, userId },
      },
      data: { role },
    });
  },

  // Milestones Operations
  async addMilestone(projectId: string, data: Omit<Prisma.MilestoneCreateInput, 'project'>) {
    const { dueDate, ...rest } = data;
    const milestone = await prisma.milestone.create({
      data: {
        ...rest,
        dueDate: dueDate ? new Date(dueDate as string) : new Date(),
        projectId,
      },
    });
    await this.recalculateProgress(projectId);
    return milestone;
  },

  async updateMilestone(id: string, projectId: string, data: Prisma.MilestoneUpdateInput) {
    const { dueDate, ...rest } = data;
    const updateData: Prisma.MilestoneUpdateInput = { ...rest };
    if (dueDate) {
      updateData.dueDate = new Date(dueDate as string);
    }
    const milestone = await prisma.milestone.update({
      where: { id },
      data: updateData,
    });
    await this.recalculateProgress(projectId);
    return milestone;
  },

  async deleteMilestone(id: string, projectId: string) {
    const result = await prisma.milestone.delete({
      where: { id },
    });
    await this.recalculateProgress(projectId);
    return result;
  },

  async recalculateProgress(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return;

    const statusProgressMap: Record<string, number> = {
      PLANNING: 10,
      DEVELOPMENT: 40,
      TESTING: 70,
      CLIENT_REVIEW: 90,
      COMPLETED: 100,
      ON_HOLD: 0,
    };

    const progress = statusProgressMap[project.status] ?? 0;

    await prisma.project.update({
      where: { id: projectId },
      data: { progress },
    });
  },

  // Project Notes
  async addNote(projectId: string, userId: string, note: string) {
    return prisma.projectNote.create({
      data: {
        projectId,
        userId,
        note,
      },
    });
  },

  async updateNote(id: string, note: string) {
    return prisma.projectNote.update({
      where: { id },
      data: { note },
    });
  },

  async deleteNote(id: string) {
    return prisma.projectNote.delete({
      where: { id },
    });
  },

  async findNoteById(id: string) {
    return prisma.projectNote.findFirst({
      where: { id },
    });
  },

  // Project Deployments
  async addDeployment(
    projectId: string,
    data: Omit<Prisma.ProjectDeploymentCreateInput, 'project'>,
  ) {
    return prisma.projectDeployment.create({
      data: {
        ...data,
        projectId,
      },
    });
  },

  async deleteDeployment(id: string) {
    return prisma.projectDeployment.delete({
      where: { id },
    });
  },

  // Project Files
  async addFile(
    projectId: string,
    data: { name: string; type: string; size: number; url: string; folder: string },
  ) {
    return prisma.projectFile.create({
      data: {
        ...data,
        projectId,
      },
    });
  },

  async deleteFile(id: string) {
    return prisma.projectFile.delete({
      where: { id },
    });
  },

  async findFileById(id: string) {
    return prisma.projectFile.findFirst({
      where: { id },
    });
  },

  // Project Activity Logs
  async logActivity(projectId: string, type: string, description: string) {
    return prisma.projectActivity.create({
      data: {
        projectId,
        type,
        description,
      },
    });
  },
};
