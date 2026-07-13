import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const calendarRepository = {
  async listEvents(params: {
    userId: string;
    projectId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { userId, projectId, startDate, endDate } = params;

    const startFilter = startDate ? new Date(startDate) : undefined;
    const endFilter = endDate ? new Date(endDate) : undefined;

    // 1. Fetch custom events
    const customEventsWhere: Prisma.CalendarEventWhereInput = {
      ...(userId ? { userId } : {}),
      ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
      ...(startFilter || endFilter
        ? {
            startTime: {
              ...(startFilter ? { gte: startFilter } : {}),
              ...(endFilter ? { lte: endFilter } : {}),
            },
          }
        : {}),
    };

    const customEvents = await prisma.calendarEvent.findMany({
      where: customEventsWhere,
      include: {
        project: { select: { projectName: true, projectCode: true } },
      },
    });

    // 2. Fetch meetings
    const meetingsWhere: Prisma.MeetingWhereInput = {
      ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
      ...(userId
        ? {
            OR: [{ organizerId: userId }, { participants: { some: { userId } } }],
          }
        : {}),
      ...(startFilter || endFilter
        ? {
            startTime: {
              ...(startFilter ? { gte: startFilter } : {}),
              ...(endFilter ? { lte: endFilter } : {}),
            },
          }
        : {}),
    };

    const meetings = await prisma.meeting.findMany({
      where: meetingsWhere,
      include: {
        project: { select: { projectName: true, projectCode: true } },
      },
    });

    // 3. Fetch Tasks due dates (status not completed)
    const tasksWhere: Prisma.TaskWhereInput = {
      deletedAt: null,
      status: { not: 'COMPLETED' },
      dueDate: { not: null },
      ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
      ...(userId ? { assignees: { some: { id: userId } } } : {}),
      ...(startFilter || endFilter
        ? {
            dueDate: {
              ...(startFilter ? { gte: startFilter } : {}),
              ...(endFilter ? { lte: endFilter } : {}),
            },
          }
        : {}),
    };

    const tasks = await prisma.task.findMany({
      where: tasksWhere,
      include: {
        project: { select: { projectName: true, projectCode: true } },
      },
    });

    // 4. Fetch Project deadlines
    const projectsWhere: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(projectId && projectId !== 'ALL' ? { id: projectId } : {}),
      ...(userId ? { projectMembers: { some: { userId } } } : {}),
      ...(startFilter || endFilter
        ? {
            deadline: {
              ...(startFilter ? { gte: startFilter } : {}),
              ...(endFilter ? { lte: endFilter } : {}),
            },
          }
        : {}),
    };

    const projects = await prisma.project.findMany({
      where: projectsWhere,
    });

    // Map all resources into a unified events array
    const mappedCustom = customEvents.map((evt) => ({
      id: evt.id,
      title: evt.title,
      description: evt.description,
      eventType: evt.eventType,
      startTime: evt.startTime,
      endTime: evt.endTime,
      userId: evt.userId,
      projectId: evt.projectId,
      project: evt.project,
    }));

    const mappedMeetings = meetings.map((m) => ({
      id: m.id,
      title: `Meeting: ${m.title}`,
      description: m.description,
      eventType: 'MEETING',
      startTime: m.startTime,
      endTime: m.endTime,
      userId: m.organizerId,
      projectId: m.projectId,
      project: m.project,
    }));

    const mappedTasks = tasks.map((t) => ({
      id: t.id,
      title: `Task Due: ${t.title}`,
      description: t.description,
      eventType: 'TASK_DUE_DATE',
      startTime: t.dueDate!,
      endTime: t.dueDate!,
      userId: '',
      projectId: t.projectId,
      project: t.project,
    }));

    const mappedProjects = projects.map((p) => ({
      id: p.id,
      title: `Project Deadline: ${p.projectName}`,
      description: p.description,
      eventType: 'DEADLINE',
      startTime: p.deadline,
      endTime: p.deadline,
      userId: p.projectManagerId,
      projectId: p.id,
      project: { projectName: p.projectName, projectCode: p.projectCode },
    }));

    return [...mappedCustom, ...mappedMeetings, ...mappedTasks, ...mappedProjects];
  },

  async createEvent(data: {
    title: string;
    description?: string;
    eventType: string;
    startTime: string | Date;
    endTime: string | Date;
    userId: string;
    projectId?: string | null;
  }) {
    return prisma.calendarEvent.create({
      data: {
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
      },
    });
  },

  async updateEvent(
    id: string,
    data: {
      title?: string;
      description?: string;
      eventType?: string;
      startTime?: string | Date;
      endTime?: string | Date;
      projectId?: string | null;
    },
  ) {
    return prisma.calendarEvent.update({
      where: { id },
      data: {
        ...data,
        ...(data.startTime ? { startTime: new Date(data.startTime) } : {}),
        ...(data.endTime ? { endTime: new Date(data.endTime) } : {}),
      },
    });
  },

  async deleteEvent(id: string) {
    return prisma.calendarEvent.delete({
      where: { id },
    });
  },
};
