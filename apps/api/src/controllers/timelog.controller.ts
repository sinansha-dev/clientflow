import type { Request, Response } from 'express';
import { timelogRepository } from '../repositories/timelog.repository';
import { ok } from '../utils/http';
import { forbidden, notFound } from '../utils/errors';
import { AuthorizationService } from '../services/authorization.service';

export const timelogController = {
  async list(req: Request, res: Response) {
    const user = req.user!;
    const { userId, projectId, taskId, status, startDate, endDate } = req.query;

    if (projectId) {
      await AuthorizationService.assertProject(projectId as string, user);
    }

    const canViewProjectLogs =
      user.role === 'ADMIN' ||
      (!!projectId &&
        (await AuthorizationService.hasProjectPermission(
          projectId as string,
          user,
          'timesheets:view',
        )));
    const filterUserId = canViewProjectLogs ? (userId as string) : user.id;

    const params: Parameters<typeof timelogRepository.list>[0] = {
      projectId: projectId as string,
      taskId: taskId as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
    };
    if (filterUserId) params.userId = filterUserId;

    const logs = await timelogRepository.list(params);

    return ok(res, 'Time logs retrieved successfully', logs);
  },

  async create(req: Request, res: Response) {
    const user = req.user!;
    const body = req.body;

    await AuthorizationService.assertProjectPermission(body.projectId, user, 'timesheets:log');
    const log = await timelogRepository.createManualEntry(user.id, body);
    return ok(res, 'Time log entry added successfully', log, 201);
  },

  async update(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;

    const entry = await timelogRepository.findById(id);
    if (!entry) {
      throw notFound('Time log not found');
    }

    if (user.role !== 'ADMIN' && entry.userId !== user.id) {
      throw forbidden("You cannot edit another user's time logs");
    }

    const updated = await timelogRepository.update(id, body);
    return ok(res, 'Time log updated successfully', updated);
  },

  async remove(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;

    const entry = await timelogRepository.findById(id);
    if (!entry) {
      throw notFound('Time log not found');
    }

    if (user.role !== 'ADMIN' && entry.userId !== user.id) {
      throw forbidden("You cannot delete another user's time logs");
    }

    await timelogRepository.delete(id);
    return ok(res, 'Time log deleted successfully');
  },

  // Stopwatch controls
  async activeTimer(req: Request, res: Response) {
    const user = req.user!;
    const active = await timelogRepository.getActiveTimer(user.id);
    return ok(res, 'Active timer status', active || null);
  },

  async startTimer(req: Request, res: Response) {
    const user = req.user!;
    const { projectId, taskId, description } = req.body;

    await AuthorizationService.assertProjectPermission(projectId, user, 'timesheets:log');
    const timer = await timelogRepository.startTimer({
      userId: user.id,
      projectId,
      taskId,
      description,
    });

    return ok(res, 'Timer started successfully', timer, 201);
  },

  async stopTimer(req: Request, res: Response) {
    const user = req.user!;
    const timer = await timelogRepository.stopTimer(user.id);
    return ok(res, 'Timer stopped successfully', timer);
  },

  // Timesheet Workflow
  async submit(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;

    const entry = await timelogRepository.findById(id);
    if (!entry) throw notFound('Time log not found');
    if (user.role !== 'ADMIN' && entry.userId !== user.id) {
      throw forbidden('Access denied');
    }

    const updated = await timelogRepository.submit(id);
    return ok(res, 'Time log submitted for approval', updated);
  },

  async approve(req: Request, res: Response) {
    const id = req.params.id!;
    const updated = await timelogRepository.approve(id);
    return ok(res, 'Time log approved successfully', updated);
  },

  async reject(req: Request, res: Response) {
    const id = req.params.id!;
    const updated = await timelogRepository.reject(id);
    return ok(res, 'Time log change requested successfully', updated);
  },

  // Analytics Reports
  async getReports(req: Request, res: Response) {
    const user = req.user!;
    const { startDate, endDate, projectId, userId } = req.query;

    // Staff can only view their own productivity unless their project role grants report access.
    if (user.role === 'CLIENT') {
      throw forbidden('Access denied');
    }

    if (projectId) {
      await AuthorizationService.assertProject(projectId as string, user);
    }

    const canViewProjectLogs =
      user.role === 'ADMIN' ||
      (!!projectId &&
        (await AuthorizationService.hasProjectPermission(
          projectId as string,
          user,
          'timesheets:view',
        )));
    const filterUserId = canViewProjectLogs ? (userId as string) : user.id;

    const report = await timelogRepository.getProductivityReport({
      startDate: startDate as string,
      endDate: endDate as string,
      projectId: projectId as string,
      userId: filterUserId,
    });

    return ok(res, 'Productivity reports aggregated successfully', report);
  },

  async bulkApprove(req: Request, res: Response) {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or empty IDs array' });
    }
    const result = await timelogRepository.bulkApprove(ids);
    return ok(res, 'Time logs approved in bulk successfully', result);
  },

  async bulkReject(req: Request, res: Response) {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or empty IDs array' });
    }
    const result = await timelogRepository.bulkReject(ids);
    return ok(res, 'Time logs change requested in bulk successfully', result);
  },
};
