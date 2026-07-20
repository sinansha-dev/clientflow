import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { projectRepository } from '../repositories/project.repository';
import { projectActivityService } from '../services/project-activity.service';
import { AuthorizationService } from '../services/authorization.service';
import { ok } from '../utils/http';
import { AppError, forbidden, notFound } from '../utils/errors';
import type { ProjectRole } from '@clientflow/types';
import { projectRoleLabels } from '@clientflow/shared';
import { notificationService, NotificationEvents } from '../services/notification.service';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

async function assertAssignableStaff(userId: string) {
  const member = await prisma.user.findFirst({
    where: { id: userId, role: 'STAFF', status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  if (!member) {
    throw new AppError(400, 'Only active Staff users can be assigned to projects');
  }
}

async function movePrimaryManagerBeforeRemoval(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { projectManagerId: true },
  });
  if (project?.projectManagerId !== userId) return;

  const replacement = await prisma.projectMember.findFirst({
    where: { projectId, userId: { not: userId }, projectRole: 'PROJECT_MANAGER' },
    select: { userId: true },
    orderBy: { joinedAt: 'asc' },
  });
  if (!replacement) {
    throw new AppError(
      400,
      'Assign another Project Manager before changing or removing this member',
    );
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { projectManagerId: replacement.userId },
  });
}

export const projectController = {
  async list(req: Request, res: Response) {
    const user = req.user!;
    const {
      search,
      status,
      priority,
      health,
      clientId,
      managerId,
      sortBy,
      sortOrder,
      page,
      limit,
    } = req.query;

    const params: Parameters<typeof projectRepository.list>[0] = {
      search: search as string,
      status: status as string,
      priority: priority as string,
      health: health as string,
      clientId: clientId as string,
      managerId: managerId as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    if (page) {
      params.page = parseInt(page as string, 10);
    }
    if (limit) {
      params.limit = parseInt(limit as string, 10);
    }

    const result = await projectRepository.list(params, user);
    return ok(res, 'Projects retrieved successfully', result);
  },

  async getById(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;

    const project = await projectRepository.findById(id, user);
    if (!project) {
      const exists = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!exists) throw notFound('Project not found');
      throw forbidden('Access denied');
    }

    return ok(res, 'Project retrieved successfully', project);
  },

  async create(req: Request, res: Response) {
    const user = req.user!;
    const { projectMembers, ...body } = req.body;

    // Check if client exists
    const clientExists = await prisma.client.findFirst({
      where: { id: body.clientId, deletedAt: null },
    });
    if (!clientExists) {
      return res.status(400).json({ success: false, message: 'Selected client does not exist' });
    }

    const assignmentIds = [
      body.projectManagerId,
      ...(projectMembers ?? []).map((member: { userId: string }) => member.userId),
    ];
    await Promise.all([...new Set(assignmentIds)].map(assertAssignableStaff));

    // Map creator, convert date strings to Date objects, and pass projectMembers as projectMembersInput
    const projectData = {
      ...body,
      createdBy: user.id,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      projectMembersInput: projectMembers, // repository handles nested team member creation separately
    };

    const project = await projectRepository.create(projectData);
    await projectActivityService.log(
      project.id,
      'PROJECT_CREATED',
      `Project "${project.projectName}" was created under client ${clientExists.companyName}`,
    );

    // Trigger Notification for Project Created
    const recipients: string[] = [project.projectManagerId];
    if (clientExists.email) recipients.push(clientExists.email);

    await notificationService
      .notifyEvent(
        NotificationEvents.PROJECT_CREATED,
        recipients,
        {
          projectName: project.projectName,
          projectCode: project.projectCode,
          clientName: clientExists.companyName,
          actionUrl: `http://localhost:5173/projects/${project.id}`,
          actionText: 'View Project Details',
        },
        { sendEmail: true },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch Project Created notification'));

    // Trigger Notifications for Assigned Team Members
    if (Array.isArray(projectMembers)) {
      for (const m of projectMembers) {
        if (m.userId && m.userId !== project.projectManagerId) {
          await notificationService
            .notifyEvent(
              NotificationEvents.PROJECT_ASSIGNED,
              [m.userId],
              {
                projectName: project.projectName,
                projectCode: project.projectCode,
                projectRole: projectRoleLabels[m.projectRole as ProjectRole] || m.projectRole,
                actionUrl: `http://localhost:5173/projects/${project.id}`,
                actionText: 'View Project Workspace',
              },
              { sendEmail: true },
            )
            .catch((err) =>
              logger.error({ err }, 'Failed to dispatch Project Assigned notification'),
            );
        }
      }
    }

    const createdProject = await projectRepository.findById(project.id, user);
    return ok(res, 'Project created successfully', createdProject, 201);
  },

  async update(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;

    const project = await projectRepository.findById(id, user);
    if (!project) {
      const exists = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!exists) throw notFound('Project not found');
      throw forbidden('Access denied');
    }

    if (!(await AuthorizationService.canManageProject(id, user))) {
      throw forbidden("Only an Admin or this project's Project Manager can edit project settings");
    }

    // Staff Project Managers cannot change billing, client, or primary manager settings.
    if (user.role === 'STAFF') {
      const restrictedFields = ['budget', 'projectManagerId', 'clientId', 'projectCode'];
      const isModifyingRestricted = restrictedFields.some((field) => body[field] !== undefined);
      if (isModifyingRestricted) {
        throw forbidden(
          'Staff members are not permitted to change billing, client, or primary manager settings',
        );
      }
    }

    const relationFields = [
      'client',
      'projectManager',
      'projectMembers',
      'milestones',
      'notes',
      'files',
      'meetings',
      'meetingsLinked',
      'timeLogs',
      'deployments',
      'activities',
      'quotations',
      'invoices',
      'expenses',
    ];
    const updateData = { ...body };
    for (const field of relationFields) {
      delete updateData[field];
    }

    // Convert date strings to Date objects for Prisma and ignore loaded relation arrays.
    if (body.startDate !== undefined) {
      updateData.startDate = new Date(body.startDate);
    }
    if (body.deadline !== undefined) {
      updateData.deadline = new Date(body.deadline);
    }

    if (user.role === 'ADMIN' && body.projectManagerId !== undefined) {
      await assertAssignableStaff(body.projectManagerId);
    }

    const updated = await projectRepository.update(id, updateData);
    if (!updated) {
      throw notFound('Project not found');
    }

    if (user.role === 'ADMIN' && body.projectManagerId !== undefined) {
      await projectRepository.addProjectMember(
        id,
        body.projectManagerId,
        'PROJECT_MANAGER',
        user.id,
      );
    }

    await projectActivityService.log(id, 'PROJECT_UPDATED', `Project details were updated`);

    // Status notifications (COMPLETED / CANCELLED)
    if (body.status && body.status !== project.status) {
      const memberUserIds = (project.projectMembers || []).map((m) => m.userId);
      const recipients: string[] = [...new Set([project.projectManagerId, ...memberUserIds])];
      if (project.client?.email) recipients.push(project.client.email);

      if (body.status === 'COMPLETED') {
        await notificationService
          .notifyEvent(
            NotificationEvents.PROJECT_COMPLETED,
            recipients,
            {
              projectName: updated.projectName,
              projectCode: updated.projectCode,
              actionUrl: `http://localhost:5173/projects/${updated.id}`,
              actionText: 'View Completed Project',
            },
            { sendEmail: true, priority: 'HIGH' },
          )
          .catch((err) =>
            logger.error({ err }, 'Failed to dispatch Project Completed notification'),
          );
      } else if (body.status === 'CANCELLED') {
        await notificationService
          .notifyEvent(
            NotificationEvents.PROJECT_CANCELLED,
            recipients,
            {
              projectName: updated.projectName,
              projectCode: updated.projectCode,
              actionUrl: `http://localhost:5173/projects/${updated.id}`,
              actionText: 'View Project',
            },
            { sendEmail: true },
          )
          .catch((err) =>
            logger.error({ err }, 'Failed to dispatch Project Cancelled notification'),
          );
      }
    }

    return ok(res, 'Project updated successfully', updated);
  },

  async archive(req: Request, res: Response) {
    const id = req.params.id!;

    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }

    await projectRepository.archive(id);
    await projectActivityService.log(
      id,
      'STATUS_CHANGED',
      `Project status was set to COMPLETED and archived`,
    );

    return ok(res, 'Project archived successfully');
  },

  async restore(req: Request, res: Response) {
    const id = req.params.id!;

    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }

    await projectRepository.restore(id);
    await projectActivityService.log(id, 'STATUS_CHANGED', `Project was restored from archive`);

    return ok(res, 'Project restored successfully');
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id!;

    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }

    await projectRepository.softDelete(id);
    await projectActivityService.log(id, 'PROJECT_DELETED', `Project was soft-deleted`);

    return ok(res, 'Project deleted successfully');
  },

  // Project member management
  async listProjectMembers(req: Request, res: Response) {
    const id = req.params.id!;
    await AuthorizationService.assertProject(id, req.user!);
    const members = await projectRepository.listProjectMembers(id);
    return ok(res, 'Project members loaded successfully', members);
  },

  async addTeamMember(req: Request, res: Response) {
    const id = req.params.id!;
    const { userId, projectRole } = req.body as {
      userId: string;
      projectRole: ProjectRole;
    };

    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }

    const canManage = await AuthorizationService.canManageMembers(id, req.user!);
    if (!canManage) {
      throw forbidden('Access denied');
    }

    if (req.user!.role === 'STAFF' && req.user!.id === userId) {
      throw forbidden('Staff cannot assign themselves to a project');
    }
    await assertAssignableStaff(userId);

    const member = await projectRepository.addProjectMember(id, userId, projectRole, req.user!.id);
    if (projectRole === 'PROJECT_MANAGER') {
      await prisma.project.update({ where: { id }, data: { projectManagerId: userId } });
    }

    await projectActivityService.log(
      id,
      'MEMBER_ADDED',
      `Team member ${member.user?.firstName} ${member.user?.lastName} was added as ${projectRoleLabels[projectRole]}`,
    );

    // Notify assigned member
    await notificationService
      .notifyEvent(
        NotificationEvents.PROJECT_ASSIGNED,
        [userId],
        {
          projectName: project.projectName,
          projectCode: project.projectCode,
          projectRole: projectRoleLabels[projectRole] || projectRole,
          actionUrl: `http://localhost:5173/projects/${project.id}`,
          actionText: 'View Project Workspace',
        },
        { sendEmail: true },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch Project Assigned notification'));

    return ok(res, 'Team member added successfully', member);
  },

  async updateTeamMember(req: Request, res: Response) {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const { projectRole } = req.body as { projectRole: ProjectRole };

    const exists = await prisma.projectMember.findFirst({ where: { projectId: id, userId } });
    if (!exists) {
      throw notFound('Team member not assigned to this project');
    }

    const canManage = await AuthorizationService.canManageMembers(id, req.user!);
    if (!canManage) {
      throw forbidden('Access denied');
    }

    if (req.user!.role === 'STAFF' && req.user!.id === userId) {
      throw forbidden('Project Managers cannot change their own project role');
    }
    await assertAssignableStaff(userId);

    if (projectRole !== 'PROJECT_MANAGER') {
      await movePrimaryManagerBeforeRemoval(id, userId);
    }

    const updated = await projectRepository.updateProjectMemberRole(id, userId, projectRole);
    if (projectRole === 'PROJECT_MANAGER') {
      await prisma.project.update({ where: { id }, data: { projectManagerId: userId } });
    }

    await projectActivityService.log(
      id,
      'MEMBER_UPDATED',
      `Team member role was updated to ${projectRoleLabels[projectRole]}`,
    );

    return ok(res, 'Team member role updated successfully', updated);
  },

  async removeTeamMember(req: Request, res: Response) {
    const id = req.params.id as string;
    const userId = req.params.userId as string;

    const exists = await prisma.projectMember.findFirst({ where: { projectId: id, userId } });
    if (!exists) {
      throw notFound('Team member not assigned to this project');
    }

    const canManage = await AuthorizationService.canManageMembers(id, req.user!);
    if (!canManage) {
      throw forbidden('Access denied');
    }

    if (req.user!.role === 'STAFF' && req.user!.id === userId) {
      throw forbidden('Project Managers cannot remove themselves from a project');
    }

    await movePrimaryManagerBeforeRemoval(id, userId);
    await projectRepository.removeProjectMember(id, userId);
    await projectActivityService.log(
      id,
      'MEMBER_REMOVED',
      `Team member was removed from the project`,
    );

    return ok(res, 'Team member removed successfully');
  },

  // Milestones Controllers
  async getMilestones(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const project = await projectRepository.findById(id, user);
    if (!project) {
      const exists = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!exists) throw notFound('Project not found');
      throw forbidden('Access denied');
    }
    return ok(res, 'Milestones loaded successfully', project.milestones);
  },

  async addMilestone(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;

    const project = await projectRepository.findById(id, user);
    if (!project) {
      const exists = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!exists) throw notFound('Project not found');
      throw forbidden('Access denied');
    }

    await AuthorizationService.assertProjectPermission(id, user, 'project:manage');
    const milestone = await projectRepository.addMilestone(id, body);
    await projectActivityService.log(
      id,
      'MILESTONE_ADDED',
      `Milestone "${milestone.title}" was added`,
    );

    return ok(res, 'Milestone created successfully', milestone, 201);
  },

  async updateMilestone(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;

    const milestone = await prisma.milestone.findFirst({ where: { id } });
    if (!milestone) {
      throw notFound('Milestone not found');
    }

    await AuthorizationService.assertProjectPermission(milestone.projectId, user, 'project:manage');

    const updated = await projectRepository.updateMilestone(id, milestone.projectId, body);
    if (body.status && body.status !== milestone.status) {
      await projectActivityService.log(
        milestone.projectId,
        'STATUS_CHANGED',
        `Milestone "${milestone.title}" status changed to ${body.status}`,
      );
    }

    return ok(res, 'Milestone updated successfully', updated);
  },

  async deleteMilestone(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;

    const milestone = await prisma.milestone.findFirst({ where: { id } });
    if (!milestone) {
      throw notFound('Milestone not found');
    }

    await AuthorizationService.assertProjectPermission(milestone.projectId, user, 'project:manage');

    await projectRepository.deleteMilestone(id, milestone.projectId);
    await projectActivityService.log(
      milestone.projectId,
      'MILESTONE_DELETED',
      `Milestone "${milestone.title}" was deleted`,
    );

    return ok(res, 'Milestone deleted successfully');
  },

  // Notes Controllers
  async getNotes(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const project = await projectRepository.findById(id, user);
    if (!project) {
      const exists = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!exists) throw notFound('Project not found');
      throw forbidden('Access denied');
    }
    return ok(res, 'Project notes loaded successfully', project.notes);
  },

  async addNote(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const { note } = req.body;

    const project = await projectRepository.findById(id, user);
    if (!project) {
      const exists = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!exists) throw notFound('Project not found');
      throw forbidden('Access denied');
    }

    const projectNote = await projectRepository.addNote(id, user.id, note);
    await projectActivityService.log(
      id,
      'NOTES_UPDATED',
      `Project internal note was added by ${user.firstName}`,
    );

    return ok(res, 'Note added successfully', projectNote, 201);
  },

  async updateNote(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;
    const { note } = req.body;

    const projectNote = await projectRepository.findNoteById(id);
    if (!projectNote) {
      throw notFound('Note not found');
    }

    await AuthorizationService.assertProject(projectNote.projectId, user);

    const updated = await projectRepository.updateNote(id, note);
    return ok(res, 'Note updated successfully', updated);
  },

  async deleteNote(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;

    const projectNote = await projectRepository.findNoteById(id);
    if (!projectNote) {
      throw notFound('Note not found');
    }

    await AuthorizationService.assertProject(projectNote.projectId, user);

    await projectRepository.deleteNote(id);
    return ok(res, 'Note deleted successfully');
  },

  // Deployments Controllers
  async addDeployment(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;

    const project = await projectRepository.findById(id, user);
    if (!project) {
      const exists = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!exists) throw notFound('Project not found');
      throw forbidden('Access denied');
    }

    await AuthorizationService.assertProjectPermission(id, user, 'project:manage');
    const deployment = await projectRepository.addDeployment(id, body);
    await projectActivityService.log(
      id,
      'DEPLOYMENT_ADDED',
      `Deployment environment ${body.environment} (v${body.version}) was logged`,
    );

    return ok(res, 'Deployment added successfully', deployment, 201);
  },

  async deleteDeployment(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;

    const deployment = await prisma.projectDeployment.findFirst({ where: { id } });
    if (!deployment) {
      throw notFound('Deployment not found');
    }

    await AuthorizationService.assertProjectPermission(
      deployment.projectId,
      user,
      'project:manage',
    );

    await projectRepository.deleteDeployment(id);
    return ok(res, 'Deployment deleted successfully');
  },

  // File Upload Controllers
  async getFiles(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;
    const project = await projectRepository.findById(id, user);
    if (!project) {
      const exists = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!exists) throw notFound('Project not found');
      throw forbidden('Access denied');
    }
    return ok(res, 'Files retrieved successfully', project.files);
  },

  async uploadFile(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;
    const file = req.file;
    const { folder = 'DOCUMENTS' } = req.body;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const project = await projectRepository.findById(id, user);
    if (!project) {
      const exists = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!exists) throw notFound('Project not found');
      throw forbidden('Access denied');
    }

    const fileUrl = `/uploads/${file.filename}`;
    const projectFile = await projectRepository.addFile(id, {
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      url: fileUrl,
      folder,
    });

    await projectActivityService.log(
      id,
      'FILE_UPLOADED',
      `Project document "${file.originalname}" was uploaded to ${folder}`,
    );

    return ok(res, 'File uploaded successfully', projectFile, 201);
  },

  async deleteFile(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;

    const projectFile = await projectRepository.findFileById(id);
    if (!projectFile) {
      throw notFound('File not found');
    }

    await AuthorizationService.assertProject(projectFile.projectId, user);

    // Delete physical file
    const filePath = path.join(__dirname, '../../uploads', path.basename(projectFile.url));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(err);
      }
    }

    await projectRepository.deleteFile(id);
    await projectActivityService.log(
      projectFile.projectId,
      'FILE_DELETED',
      `Document "${projectFile.name}" was deleted`,
    );

    return ok(res, 'File deleted successfully');
  },
};
