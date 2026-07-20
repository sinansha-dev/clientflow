import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { teamRepository } from '../repositories/team.repository';
import { ok } from '../utils/http';
import { forbidden, notFound } from '../utils/errors';
import { prisma } from '../config/prisma';
import { notificationService, NotificationEvents } from '../services/notification.service';
import { logger } from '../utils/logger';

export const teamController = {
  async create(req: Request, res: Response) {
    const {
      email,
      password,
      role,
      firstName,
      lastName,
      employeeId,
      jobTitle,
      department,
      skills,
      hourlyRate,
      employmentType,
      joinDate,
      timezone,
    } = req.body;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: 'Email address is already registered' });
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const member = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role || 'STAFF',
        firstName,
        lastName,
        employeeId: employeeId || null,
        jobTitle: jobTitle || null,
        department: department || null,
        skills: skills || [],
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
        employmentType: employmentType || 'Full-Time',
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        timezone: timezone || 'UTC',
        status: 'ACTIVE',
      },
    });

    // Send Welcome Email Notification to newly created member
    await notificationService
      .notifyEvent(
        NotificationEvents.AUTH_WELCOME,
        [member.id],
        {
          recipientName: `${member.firstName} ${member.lastName}`,
          userEmail: member.email,
          role: member.role,
        },
        { sendEmail: true },
      )
      .catch((err) =>
        logger.error({ err }, 'Failed to dispatch welcome notification for team member'),
      );

    return ok(res, 'Team member manually created successfully', member, 201);
  },

  async list(req: Request, res: Response) {
    const { department, role, skills, availability, employmentType, search, page, limit } =
      req.query;

    const data = await teamRepository.list({
      department: department as string,
      role: role as string,
      skills: skills as string,
      availability: availability as string,
      employmentType: employmentType as string,
      search: search as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });

    return ok(res, 'Team roster retrieved successfully', data);
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id!;
    if (req.user!.role !== 'ADMIN' && req.user!.id !== id) {
      throw forbidden('You cannot view another team member profile');
    }
    const item = await teamRepository.findById(id);
    if (!item) {
      throw notFound('Team member profile not found');
    }
    return ok(res, 'Team member details retrieved successfully', item);
  },

  async update(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;

    if (user.role !== 'ADMIN' && user.id !== id) {
      throw forbidden('You cannot edit another team member profile');
    }

    const updateData: Parameters<typeof teamRepository.update>[1] = {};
    if (body.employeeId !== undefined) updateData.employeeId = body.employeeId || null;
    if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle || null;
    if (body.department !== undefined) updateData.department = body.department || null;
    if (Array.isArray(body.skills)) updateData.skills = body.skills;
    if (body.availabilityStatus !== undefined)
      updateData.availabilityStatus = body.availabilityStatus;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;

    if (user.role === 'ADMIN') {
      if (body.hourlyRate !== undefined) {
        updateData.hourlyRate =
          body.hourlyRate === null || body.hourlyRate === '' ? null : Number(body.hourlyRate);
      }
      if (body.employmentType !== undefined) updateData.employmentType = body.employmentType;
      if (body.joinDate !== undefined)
        updateData.joinDate = body.joinDate ? new Date(body.joinDate) : null;
    }
    const updated = await teamRepository.update(id, updateData);
    return ok(res, 'Profile updated successfully', updated);
  },

  async updateStatus(req: Request, res: Response) {
    const id = req.params.id!;
    const { status } = req.body; // ACTIVE or INACTIVE

    const member = await teamRepository.findById(id);
    if (!member) {
      throw notFound('Team member profile not found');
    }

    if (status === 'INACTIVE') {
      await teamRepository.deactivate(id);
      // Trigger Account Locked Notification
      await notificationService
        .notifyEvent(
          NotificationEvents.AUTH_ACCOUNT_LOCKED,
          [id],
          {
            recipientName: `${member.firstName} ${member.lastName}`,
            userEmail: member.email,
          },
          { sendEmail: true, priority: 'HIGH' },
        )
        .catch((err) => logger.error({ err }, 'Failed to dispatch account locked notification'));
    } else {
      await teamRepository.activate(id);
      // Trigger Account Activated Notification
      await notificationService
        .notifyEvent(
          NotificationEvents.AUTH_ACCOUNT_ACTIVATED,
          [id],
          {
            recipientName: `${member.firstName} ${member.lastName}`,
            userEmail: member.email,
          },
          { sendEmail: true },
        )
        .catch((err) => logger.error({ err }, 'Failed to dispatch account activated notification'));
    }

    return ok(res, 'Team member profile status updated successfully');
  },

  async resetPassword(req: Request, res: Response) {
    const id = req.params.id!;
    const { password } = req.body;

    const member = await teamRepository.findById(id);
    if (!member) {
      throw notFound('Team member profile not found');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword, status: 'ACTIVE' },
    });

    // Trigger Password Changed Notification
    await notificationService
      .notifyEvent(
        NotificationEvents.AUTH_PASSWORD_CHANGED,
        [id],
        {
          recipientName: `${member.firstName} ${member.lastName}`,
          userEmail: member.email,
        },
        { sendEmail: true, priority: 'HIGH' },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch password changed notification'));

    return ok(res, 'Team member password reset successfully');
  },

  async invite(req: Request, res: Response) {
    const { email, role, firstName, lastName, jobTitle, department } = req.body;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: 'Email address is already registered' });
    }

    const invitationLink = `http://localhost:5173/register?email=${encodeURIComponent(email)}&role=${role || 'STAFF'}`;

    // Dispatch Invitation Email Notification through NotificationService
    await notificationService
      .notifyEvent(
        NotificationEvents.AUTH_USER_INVITED,
        [email],
        {
          recipientName: firstName ? `${firstName} ${lastName || ''}`.trim() : email,
          userEmail: email,
          role: role || 'STAFF',
          inviteLink: invitationLink,
          actionUrl: invitationLink,
          actionText: 'Accept Invitation',
        },
        { sendEmail: true, priority: 'HIGH' },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch user invitation notification'));

    return ok(
      res,
      'Invitation logged and sent successfully',
      {
        email,
        role: role || 'STAFF',
        invitationLink,
      },
      201,
    );
  },
};
