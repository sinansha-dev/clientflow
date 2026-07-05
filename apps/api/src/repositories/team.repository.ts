import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const teamRepository = {
  async list(params: {
    department?: string;
    role?: string;
    skills?: string;
    availability?: string;
    employmentType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      department,
      role,
      skills,
      availability,
      employmentType,
      search,
      page = 1,
      limit = 10,
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      NOT: { role: 'CLIENT' }, // Exclude clients from team list
      ...(department && department !== 'ALL' ? { department } : {}),
      ...(role && role !== 'ALL' ? { role: role as any } : {}),
      ...(availability && availability !== 'ALL' ? { availabilityStatus: availability } : {}),
      ...(employmentType && employmentType !== 'ALL' ? { employmentType } : {}),
      ...(skills && skills !== 'ALL' ? { skills: { has: skills } } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { jobTitle: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          role: true,
          status: true,
          employeeId: true,
          jobTitle: true,
          department: true,
          skills: true,
          availabilityStatus: true,
          employmentType: true,
          joinDate: true,
          timezone: true,
          projectTeams: {
            select: {
              projectId: true,
            },
          },
          assignedTasks: {
            where: { status: { not: 'COMPLETED' }, deletedAt: null },
            select: { id: true },
          },
          timeLogs: {
            where: {
              startTime: {
                gte: new Date(new Date().setDate(new Date().getDate() - 7)), // Last 7 days
              },
            },
            select: { duration: true },
          },
        },
        orderBy: { firstName: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    // Format current metrics dynamically
    const formatted = items.map((item) => {
      const weeklyHours = item.timeLogs.reduce(
        (acc: number, log: { duration: number }) => acc + log.duration,
        0,
      );
      return {
        ...item,
        projectsCount: item.projectTeams.length,
        activeTasksCount: item.assignedTasks.length,
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        timeLogs: undefined, // remove raw array from output
      };
    });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: formatted,
    };
  },

  async findById(id: string) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null, NOT: { role: 'CLIENT' } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        employeeId: true,
        jobTitle: true,
        department: true,
        skills: true,
        hourlyRate: true,
        employmentType: true,
        joinDate: true,
        managerId: true,
        availabilityStatus: true,
        timezone: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        projectTeams: {
          include: {
            project: {
              select: {
                id: true,
                projectName: true,
                projectCode: true,
                status: true,
              },
            },
          },
        },
        assignedTasks: {
          where: { deletedAt: null },
          include: {
            project: {
              select: {
                id: true,
                projectName: true,
                projectCode: true,
              },
            },
          },
        },
        timeLogs: {
          orderBy: { startTime: 'desc' },
          take: 50,
          include: {
            project: { select: { projectName: true, projectCode: true } },
            task: { select: { title: true } },
          },
        },
        meetingsAttending: {
          include: {
            meeting: {
              include: {
                organizer: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { meeting: { startTime: 'desc' } },
          take: 10,
        },
      },
    });

    if (!user) return null;

    // Calculate utilization & metrics
    const weeklyLogs = await prisma.timeLog.findMany({
      where: {
        userId: id,
        startTime: {
          gte: new Date(new Date().setDate(new Date().getDate() - 7)),
        },
      },
      select: { duration: true, billable: true },
    });

    const weeklyHours = weeklyLogs.reduce(
      (acc: number, log: { duration: number }) => acc + log.duration,
      0,
    );
    const billableHours = weeklyLogs
      .filter((l: { billable: boolean }) => l.billable)
      .reduce((acc: number, log: { duration: number }) => acc + log.duration, 0);
    const utilization = weeklyHours > 0 ? Math.round((billableHours / weeklyHours) * 100) : 0;

    return {
      ...user,
      metrics: {
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        billableHours: Math.round(billableHours * 10) / 10,
        utilization,
      },
    };
  },

  async update(id: string, data: Partial<Prisma.UserUpdateInput>) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        employeeId: true,
        jobTitle: true,
        department: true,
        skills: true,
        hourlyRate: true,
        employmentType: true,
        availabilityStatus: true,
        timezone: true,
      },
    });
  },

  async deactivate(id: string) {
    return prisma.user.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
  },

  async activate(id: string) {
    return prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  },
};
