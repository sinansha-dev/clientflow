import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const meetingRepository = {
  async list(params: {
    userId?: string;
    projectId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { userId, projectId, startDate, endDate } = params;

    const where: Prisma.MeetingWhereInput = {
      ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
      ...(userId
        ? {
            OR: [{ organizerId: userId }, { participants: { some: { userId } } }],
          }
        : {}),
      ...(startDate || endDate
        ? {
            startTime: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    return prisma.meeting.findMany({
      where,
      include: {
        project: { select: { projectName: true, projectCode: true } },
        organizer: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  },

  async findById(id: string) {
    return prisma.meeting.findUnique({
      where: { id },
      include: {
        project: true,
        organizer: true,
        participants: {
          include: {
            user: true,
          },
        },
      },
    });
  },

  async create(data: {
    projectId?: string | null;
    title: string;
    description?: string;
    startTime: string | Date;
    endTime: string | Date;
    meetingType: string;
    platform: string;
    meetingLink: string;
    organizerId: string;
    participantIds: string[];
  }) {
    const { participantIds, ...meetingData } = data;
    const start = new Date(meetingData.startTime);
    const end = new Date(meetingData.endTime);

    // Overlapping meetings validation for organizer and participants
    const allUserIds = [meetingData.organizerId, ...participantIds];
    const overlap = await prisma.meeting.findFirst({
      where: {
        startTime: { lt: end },
        endTime: { gt: start },
        OR: [
          { organizerId: { in: allUserIds } },
          { participants: { some: { userId: { in: allUserIds } } } },
        ],
      },
    });

    if (overlap) {
      throw new Error(
        'Organizer or one of the participants has an overlapping meeting scheduled in this block',
      );
    }

    return prisma.meeting.create({
      data: {
        ...meetingData,
        startTime: start,
        endTime: end,
        participants: {
          create: participantIds.map((userId) => ({
            userId,
            attendanceStatus: 'INVITED',
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
      },
    });
  },

  async update(
    id: string,
    data: {
      projectId?: string | null;
      title?: string;
      description?: string;
      startTime?: string | Date;
      endTime?: string | Date;
      meetingType?: string;
      platform?: string;
      meetingLink?: string;
      participantIds?: string[];
    },
  ) {
    const { participantIds, ...meetingData } = data;

    const current = await prisma.meeting.findUnique({ where: { id } });
    if (!current) throw new Error('Meeting not found');

    const updateData: Prisma.MeetingUpdateInput = {
      ...meetingData,
      ...(meetingData.startTime ? { startTime: new Date(meetingData.startTime) } : {}),
      ...(meetingData.endTime ? { endTime: new Date(meetingData.endTime) } : {}),
    };

    if (participantIds) {
      // Re-connect participants
      await prisma.meetingParticipant.deleteMany({ where: { meetingId: id } });
      updateData.participants = {
        create: participantIds.map((userId) => ({
          userId,
          attendanceStatus: 'INVITED',
        })),
      };
    }

    return prisma.meeting.update({
      where: { id },
      data: updateData,
      include: {
        participants: true,
      },
    });
  },

  async delete(id: string) {
    return prisma.meeting.delete({
      where: { id },
    });
  },

  // Attendee RSVP response toggle
  async updateAttendance(meetingId: string, userId: string, attendanceStatus: string) {
    return prisma.meetingParticipant.upsert({
      where: {
        meetingId_userId: { meetingId, userId },
      },
      update: { attendanceStatus },
      create: { meetingId, userId, attendanceStatus },
    });
  },
};
