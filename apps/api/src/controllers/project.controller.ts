import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { projectRepository } from '../repositories/project.repository';
import { projectActivityService } from '../services/project-activity.service';
import { ok } from '../utils/http';
import { forbidden, notFound } from '../utils/errors';
import fs from 'fs';
import path from 'path';

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

    const params: any = {
      search: search as string,
      status: status as string,
      priority: priority as string,
      health: health as string,
      clientId: clientId as string,
      managerId: managerId as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    };

    // Developer can only view assigned projects
    if (user.role === 'DEVELOPER') {
      params.userId = user.id; // Repository will filter by this userId in team members
    }

    const result = await projectRepository.list(params);
    return ok(res, 'Projects retrieved successfully', result);
  },

  async getById(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;

    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }

    // Developer can only view assigned projects
    if (user.role === 'DEVELOPER') {
      const isMember = project.teamMembers?.some((tm) => tm.userId === user.id);
      if (!isMember) {
        throw forbidden('You are not assigned to this project');
      }
    }

    return ok(res, 'Project retrieved successfully', project);
  },

  async create(req: Request, res: Response) {
    const user = req.user!;
    const body = req.body;

    // Check if client exists
    const clientExists = await prisma.client.findFirst({
      where: { id: body.clientId, deletedAt: null },
    });
    if (!clientExists) {
      return res.status(400).json({ success: false, message: 'Selected client does not exist' });
    }

    // Map creator
    const projectData = {
      ...body,
      createdBy: user.id,
    };

    const project = await projectRepository.create(projectData);
    await projectActivityService.log(
      project.id,
      'PROJECT_CREATED',
      `Project "${project.projectName}" was created under client ${clientExists.companyName}`,
    );

    const createdProject = await projectRepository.findById(project.id);
    return ok(res, 'Project created successfully', createdProject, 201);
  },

  async update(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;

    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }

    // Developer restrictions: Cannot edit budget, owner (manager), client, or priority if not on team
    if (user.role === 'DEVELOPER') {
      const isMember = project.teamMembers?.some((tm) => tm.userId === user.id);
      if (!isMember) {
        throw forbidden('You cannot update a project you are not assigned to');
      }

      const restrictedFields = ['budget', 'projectManagerId', 'clientId', 'projectCode'];
      const isModifyingRestricted = restrictedFields.some((field) => body[field] !== undefined);
      if (isModifyingRestricted) {
        throw forbidden(
          'Developers are not permitted to change billing, client, or manager settings',
        );
      }
    }

    const updated = await projectRepository.update(id, body);
    await projectActivityService.log(id, 'PROJECT_UPDATED', `Project details were updated`);

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

  // Team Management Controllers
  async addTeamMember(req: Request, res: Response) {
    const id = req.params.id!;
    const { userId, role } = req.body;

    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }

    const member = await projectRepository.addTeamMember(id, userId, role);
    await projectActivityService.log(
      id,
      'MEMBER_ADDED',
      `Team member ${member.user?.firstName} ${member.user?.lastName} was added as ${role}`,
    );

    return ok(res, 'Team member added successfully', member);
  },

  async updateTeamMember(req: Request, res: Response) {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const { role } = req.body;

    const exists = await prisma.projectTeam.findFirst({ where: { projectId: id, userId } });
    if (!exists) {
      throw notFound('Team member not assigned to this project');
    }

    const updated = await projectRepository.updateTeamMemberRole(id, userId, role);
    await projectActivityService.log(
      id,
      'MEMBER_UPDATED',
      `Team member role was updated to ${role}`,
    );

    return ok(res, 'Team member role updated successfully', updated);
  },

  async removeTeamMember(req: Request, res: Response) {
    const id = req.params.id as string;
    const userId = req.params.userId as string;

    const exists = await prisma.projectTeam.findFirst({ where: { projectId: id, userId } });
    if (!exists) {
      throw notFound('Team member not assigned to this project');
    }

    await projectRepository.removeTeamMember(id, userId);
    await projectActivityService.log(
      id,
      'MEMBER_REMOVED',
      `Team member was removed from the project`,
    );

    return ok(res, 'Team member removed successfully');
  },

  // Milestones Controllers
  async getMilestones(req: Request, res: Response) {
    const id = req.params.id!;
    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }
    return ok(res, 'Milestones loaded successfully', project.milestones);
  },

  async addMilestone(req: Request, res: Response) {
    const id = req.params.id!;
    const body = req.body;

    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }

    const milestone = await projectRepository.addMilestone(id, body);
    await projectActivityService.log(
      id,
      'MILESTONE_ADDED',
      `Milestone "${milestone.title}" was added`,
    );

    return ok(res, 'Milestone created successfully', milestone, 201);
  },

  async updateMilestone(req: Request, res: Response) {
    const id = req.params.id!; // milestone ID
    const body = req.body;

    const milestone = await prisma.milestone.findFirst({ where: { id } });
    if (!milestone) {
      throw notFound('Milestone not found');
    }

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
    const id = req.params.id!; // milestone ID

    const milestone = await prisma.milestone.findFirst({ where: { id } });
    if (!milestone) {
      throw notFound('Milestone not found');
    }

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
    const id = req.params.id!;
    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }
    return ok(res, 'Project notes loaded successfully', project.notes);
  },

  async addNote(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const { note } = req.body;

    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
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
    const id = req.params.id as string;
    const { note } = req.body;

    const projectNote = await projectRepository.findNoteById(id);
    if (!projectNote) {
      throw notFound('Note not found');
    }

    const updated = await projectRepository.updateNote(id, note);
    return ok(res, 'Note updated successfully', updated);
  },

  async deleteNote(req: Request, res: Response) {
    const id = req.params.id as string;

    const projectNote = await projectRepository.findNoteById(id);
    if (!projectNote) {
      throw notFound('Note not found');
    }

    await projectRepository.deleteNote(id);
    return ok(res, 'Note deleted successfully');
  },

  // Deployments Controllers
  async addDeployment(req: Request, res: Response) {
    const id = req.params.id!;
    const body = req.body;

    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }

    const deployment = await projectRepository.addDeployment(id, body);
    await projectActivityService.log(
      id,
      'DEPLOYMENT_ADDED',
      `Deployment environment ${body.environment} (v${body.version}) was logged`,
    );

    return ok(res, 'Deployment added successfully', deployment, 201);
  },

  async deleteDeployment(req: Request, res: Response) {
    const id = req.params.id!;

    const deployment = await prisma.projectDeployment.findFirst({ where: { id } });
    if (!deployment) {
      throw notFound('Deployment not found');
    }

    await projectRepository.deleteDeployment(id);
    return ok(res, 'Deployment deleted successfully');
  },

  // File Upload Controllers
  async getFiles(req: Request, res: Response) {
    const id = req.params.id as string;
    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
    }
    return ok(res, 'Files retrieved successfully', project.files);
  },

  async uploadFile(req: Request, res: Response) {
    const id = req.params.id as string;
    const file = req.file;
    const { folder = 'DOCUMENTS' } = req.body;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const project = await projectRepository.findById(id);
    if (!project) {
      throw notFound('Project not found');
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
    const id = req.params.id as string;

    const projectFile = await projectRepository.findFileById(id);
    if (!projectFile) {
      throw notFound('File not found');
    }

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
