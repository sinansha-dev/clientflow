import type { Request, Response } from 'express';
import { meetingRepository } from '../repositories/meeting.repository';
import { calendarRepository } from '../repositories/calendar.repository';
import { ok } from '../utils/http';
import { forbidden, notFound } from '../utils/errors';

export const meetingController = {
  // --- Meeting Controllers ---
  async listMeetings(req: Request, res: Response) {
    const user = req.user!;
    const { projectId, startDate, endDate } = req.query;

    const filterUserId = user.role === 'CLIENT' ? undefined : user.id;

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

    if (user.role === 'CLIENT') {
      const isInvited = meeting.participants?.some((p: any) => p.userId === user.id);
      if (!isInvited) throw forbidden('Access denied');
    }

    return ok(res, 'Meeting details retrieved successfully', meeting);
  },

  async createMeeting(req: Request, res: Response) {
    const user = req.user!;
    const body = req.body;

    const meeting = await meetingRepository.create({
      ...body,
      organizerId: user.id,
    });

    return ok(res, 'Meeting scheduled successfully', meeting, 201);
  },

  async updateMeeting(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;

    const meeting = await meetingRepository.findById(id);
    if (!meeting) throw notFound('Meeting not found');

    if (user.role !== 'ADMIN' && meeting.organizerId !== user.id) {
      throw forbidden('Only the organizer or an admin can edit this meeting');
    }

    const updated = await meetingRepository.update(id, body);
    return ok(res, 'Meeting updated successfully', updated);
  },

  async deleteMeeting(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;

    const meeting = await meetingRepository.findById(id);
    if (!meeting) throw notFound('Meeting not found');

    if (user.role !== 'ADMIN' && meeting.organizerId !== user.id) {
      throw forbidden('Only the organizer or an admin can cancel this meeting');
    }

    await meetingRepository.delete(id);
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

    const event = await calendarRepository.createEvent({
      ...body,
      userId: user.id,
    });

    return ok(res, 'Calendar event created successfully', event, 201);
  },

  async updateCalendarEvent(req: Request, res: Response) {
    const id = req.params.id!;
    const body = req.body;

    const updated = await calendarRepository.updateEvent(id, body);
    return ok(res, 'Calendar event updated successfully', updated);
  },

  async deleteCalendarEvent(req: Request, res: Response) {
    const id = req.params.id!;
    await calendarRepository.deleteEvent(id);
    return ok(res, 'Calendar event deleted successfully');
  },
};
