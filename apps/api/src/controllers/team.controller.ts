import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { teamRepository } from '../repositories/team.repository';
import { ok } from '../utils/http';
import { forbidden, notFound } from '../utils/errors';
import { prisma } from '../config/prisma';

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
        role: role || 'DEVELOPER',
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

    // Check permissions: Admin can edit anyone. Developers/Staff can only edit themselves.
    if (user.role !== 'ADMIN' && user.id !== id) {
      throw forbidden('You cannot edit another team member profile');
    }

    const updated = await teamRepository.update(id, body);
    return ok(res, 'Profile updated successfully', updated);
  },

  async updateStatus(req: Request, res: Response) {
    const id = req.params.id!;
    const { status } = req.body; // ACTIVE or INACTIVE

    if (status === 'INACTIVE') {
      await teamRepository.deactivate(id);
    } else {
      await teamRepository.activate(id);
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

    return ok(res, 'Team member password reset successfully');
  },

  async invite(req: Request, res: Response) {
    const { email, role, firstName, lastName, jobTitle, department } = req.body;

    // Simulate sending invitation email
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: 'Email address is already registered' });
    }

    // In a real application, we would create a temporary invitation record and email a token.
    // For this build, we return the details as mock verification.
    return ok(
      res,
      'Invitation logged and sent successfully (Simulated)',
      {
        email,
        role,
        invitationLink: `http://localhost:5173/register?email=${encodeURIComponent(email)}&role=${role}`,
      },
      201,
    );
  },
};
