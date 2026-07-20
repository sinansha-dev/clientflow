import type { Request, Response } from 'express';
import { meetingRepository } from '../repositories/meeting.repository';
import { calendarRepository } from '../repositories/calendar.repository';
import { ok } from '../utils/http';
import { forbidden, notFound } from '../utils/errors';
import { AuthorizationService } from '../services/authorization.service';
import { prisma } from '../config/prisma';
import { notificationService, NotificationEvents } from '../services/notification.service';
import { logger } from '../utils/logger';

export const meetingController = {
  // --- Meeting Controllers ---
  async listMeetings(req: Request, res: Response) {
    const user = req.user!;
    const { projectId, startDate, endDate } = req.query;

    if (projectId) {
      await AuthorizationService.assertProject(projectId as string, user);
    }

    const canManageProjectMeetings =
      user.role === 'ADMIN' ||
      (!!projectId && (await AuthorizationService.canManageMeetings(projectId as string, user)));
    const filterUserId = canManageProjectMeetings || user.role === 'CLIENT' ? undefined : user.id;

    const params: any = {
      projectId: projectId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    };
    if (filterUserId) {
      params.userId = filterUserId;
    }

    const meetings = await meetingRepository.list(params);

    // Client restriction: Clients can only see meetings where they are invitees
    if (user.role === 'CLIENT') {
      const clientMeetings = meetings.filter((m: any) =>
        m.participants.some((p: any) => p.userId === user.id),
      );
      return ok(res, 'Meetings retrieved successfully', clientMeetings);
    }

    return ok(res, 'Meetings retrieved successfully', meetings);
  },

  async getMeetingById(req: Request, res: Response) {
    const id = req.params.id!;
    const user = req.user!;

    const meeting = await meetingRepository.findById(id);
    if (!meeting) throw notFound('Meeting not found');

    if (!(await AuthorizationService.canAccessMeeting(id, user))) {
      throw forbidden('Access denied');
    }

    return ok(res, 'Meeting details retrieved successfully', meeting);
  },

  async createMeeting(req: Request, res: Response) {
    const user = req.user!;
    const body = req.body;

    if (
      user.role !== 'ADMIN' &&
      (!body.projectId || !(await AuthorizationService.canManageMeetings(body.projectId, user)))
    ) {
      throw forbidden('Only an Admin or Project Manager can schedule project meetings');
    }

    const meeting = await meetingRepository.create({
      ...body,
      organizerId: user.id,
    });

    // Resolve participants for Meeting Scheduled notification
    const participantUserIds: string[] = (meeting.participants || []).map((p: any) => p.userId);
    const recipients = [...new Set([user.id, ...participantUserIds])];

    await notificationService
      .notifyEvent(
        NotificationEvents.MEETING_SCHEDULED,
        recipients,
        {
          meetingTitle: meeting.title,
          meetingDate: `${new Date(meeting.startTime).toLocaleString()} - ${new Date(meeting.endTime).toLocaleTimeString()}`,
          meetingLink: meeting.meetingLink,
          actionUrl: meeting.meetingLink || `http://localhost:5173/meetings/${meeting.id}`,
          actionText: 'Join Meeting',
        },
        { sendEmail: true, priority: 'HIGH' },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch Meeting Scheduled notification'));

    return ok(res, 'Meeting scheduled successfully', meeting, 201);
  },

  async updateMeeting(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;

    const meeting = await meetingRepository.findById(id);
    if (!meeting) throw notFound('Meeting not found');

    const canManageProject =
      !!meeting.projectId &&
      (await AuthorizationService.canManageMeetings(meeting.projectId, user));
    if (user.role !== 'ADMIN' && !canManageProject && meeting.organizerId !== user.id) {
      throw forbidden('Only the organizer, Project Manager, or an Admin can edit this meeting');
    }

    const updated = await meetingRepository.update(id, body);
    return ok(res, 'Meeting updated successfully', updated);
  },

  async deleteMeeting(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;

    const meeting = await meetingRepository.findById(id);
    if (!meeting) throw notFound('Meeting not found');

    const canManageProject =
      !!meeting.projectId &&
      (await AuthorizationService.canManageMeetings(meeting.projectId, user));
    if (user.role !== 'ADMIN' && !canManageProject && meeting.organizerId !== user.id) {
      throw forbidden('Only the organizer, Project Manager, or an Admin can cancel this meeting');
    }

    // Resolve recipients before deletion
    const participantUserIds: string[] = (meeting.participants || []).map((p: any) => p.userId);
    const recipients = [...new Set([meeting.organizerId, ...participantUserIds])];

    await meetingRepository.delete(id);

    // Trigger Notification for Meeting Cancelled
    await notificationService
      .notifyEvent(
        NotificationEvents.MEETING_CANCELLED,
        recipients,
        {
          meetingTitle: meeting.title,
          meetingDate: new Date(meeting.startTime).toLocaleString(),
        },
        { sendEmail: true, priority: 'HIGH' },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch Meeting Cancelled notification'));

    return ok(res, 'Meeting cancelled successfully');
  },

  async rsvp(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!; // meetingId
    const { status } = req.body; // INVITED, ACCEPTED, DECLINED, ATTENDED

    const meeting = await meetingRepository.findById(id);
    if (!meeting) throw notFound('Meeting not found');

    await meetingRepository.updateAttendance(id, user.id, status);
    return ok(res, 'RSVP saved successfully');
  },

  // --- Calendar Event Controllers ---
  async listCalendarEvents(req: Request, res: Response) {
    const user = req.user!;
    const { projectId, startDate, endDate } = req.query;

    const events = await calendarRepository.listEvents({
      userId: user.id,
      projectId: projectId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    return ok(res, 'Calendar events retrieved successfully', events);
  },

  async createCalendarEvent(req: Request, res: Response) {
    const user = req.user!;
    const body = req.body;

    if (body.projectId) {
      await AuthorizationService.assertProject(body.projectId, user);
    }
    const event = await calendarRepository.createEvent({
      ...body,
      userId: user.id,
    });

    return ok(res, 'Calendar event created successfully', event, 201);
  },

  async updateCalendarEvent(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;
    const event = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) throw notFound('Calendar event not found');
    if (user.role !== 'ADMIN' && event.userId !== user.id) {
      throw forbidden('You can only update your own calendar events');
    }
    if (body.projectId) {
      await AuthorizationService.assertProject(body.projectId, user);
    }

    const updated = await calendarRepository.updateEvent(id, body);
    return ok(res, 'Calendar event updated successfully', updated);
  },

  async deleteCalendarEvent(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const event = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) throw notFound('Calendar event not found');
    if (user.role !== 'ADMIN' && event.userId !== user.id) {
      throw forbidden('You can only delete your own calendar events');
    }
    await calendarRepository.deleteEvent(id);
    return ok(res, 'Calendar event deleted successfully');
  },
};
