import crypto from 'node:crypto';
import type { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { portalRepository } from '../repositories/portal.repository';
import { forbidden, notFound } from '../utils/errors';
import { env } from '../config/env';

export interface PortalUser {
  id: string;
  email: string;
  role: Role;
}

function toPortalUser(user: Express.Request['user']): PortalUser {
  if (!user) {
    throw forbidden('Authentication is required');
  }
  return { id: user.id, email: user.email, role: user.role as Role };
}

function canManage(user: PortalUser): boolean {
  return user.role === 'ADMIN' || user.role === 'STAFF';
}

function signDownload(fileId: string): { token: string; expiresAt: string } {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const token = crypto
    .createHmac('sha256', env.COOKIE_SECRET)
    .update(`${fileId}:${expiresAt}`)
    .digest('hex');
  return { token, expiresAt };
}

export const portalService = {
  toPortalUser,

  async assertProjectAccess(projectId: string, user: PortalUser) {
    const project = await portalRepository.canAccessProject(projectId, user);
    if (!project) {
      throw forbidden('You do not have access to this project');
    }
    return project;
  },

  async dashboard(requestUser: Express.Request['user']) {
    const user = toPortalUser(requestUser);
    const projects = await portalRepository.listPortalProjects(user);
    const now = new Date();
    const upcomingDeadlines = projects
      .filter((project) => new Date(project.deadline) >= now)
      .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline))
      .slice(0, 5);
    const recentFiles = projects
      .flatMap((project) =>
        project.files.map((file) => ({ ...file, projectName: project.projectName })),
      )
      .slice(0, 8);
    const recentMessages = projects
      .flatMap((project) =>
        project.portalMessages.map((message) => ({ ...message, projectName: project.projectName })),
      )
      .slice(0, 8);
    const upcomingMeetings = projects
      .flatMap((project) =>
        project.meetingsLinked.map((meeting) => ({ ...meeting, projectName: project.projectName })),
      )
      .slice(0, 8);
    const pendingApprovals = await portalRepository.listApprovals({
      status: 'PENDING',
      projectId: { in: projects.map((project) => project.id) },
    });

    return {
      metrics: {
        activeProjects: projects.filter((project) => project.status !== 'COMPLETED').length,
        pendingReviews: pendingApprovals.length,
        filesShared: recentFiles.length,
        upcomingMeetings: upcomingMeetings.length,
        outstandingInvoices: 0,
        latestMessages: recentMessages.length,
      },
      projects,
      upcomingDeadlines,
      pendingApprovals: pendingApprovals.slice(0, 6),
      recentFiles,
      recentMessages,
      upcomingMeetings,
      latestInvoices: [],
    };
  },

  async projects(requestUser: Express.Request['user']) {
    const user = toPortalUser(requestUser);
    return portalRepository.listPortalProjects(user);
  },

  async project(projectId: string, requestUser: Express.Request['user']) {
    const user = toPortalUser(requestUser);
    await this.assertProjectAccess(projectId, user);
    const project = await portalRepository.getPortalProject(projectId);
    if (!project) {
      throw notFound('Project not found');
    }
    return { ...project, approvals: project.deliverableApprovals };
  },

  async files(projectId: string, requestUser: Express.Request['user']) {
    const user = toPortalUser(requestUser);
    await this.assertProjectAccess(projectId, user);
    return portalRepository.listProjectFiles(projectId, user.role === 'CLIENT');
  },

  async uploadFile(
    projectId: string,
    requestUser: Express.Request['user'],
    file: Express.Multer.File | undefined,
    body: { folderId?: string; folder?: string; visibility?: string; deliverableStatus?: string },
  ) {
    const user = toPortalUser(requestUser);
    const project = await this.assertProjectAccess(projectId, user);
    if (!file) {
      throw notFound('No file uploaded');
    }

    const visibility = user.role === 'CLIENT' ? 'INTERNAL' : (body.visibility ?? 'CLIENT');
    const deliverableStatus =
      body.deliverableStatus ?? (user.role === 'CLIENT' ? 'DRAFT' : 'READY_FOR_REVIEW');
    const created = await portalRepository.createFile({
      projectId,
      folderId: body.folderId || null,
      folder: body.folder || 'DOCUMENTS',
      name: file.originalname,
      originalFileName: file.originalname,
      type: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
      storagePath: file.path,
      uploadedById: user.id,
      visibility,
      deliverableStatus,
      version: 1,
    });

    await portalRepository.createFileVersion({
      fileId: created.id,
      version: 1,
      fileName: created.name,
      originalFileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      storagePath: file.path,
      uploadedById: user.id,
    });

    if (deliverableStatus === 'AWAITING_APPROVAL' || deliverableStatus === 'READY_FOR_REVIEW') {
      await portalRepository.createApproval({
        projectId,
        deliverableId: created.id,
        clientId: project.clientId,
        status: 'PENDING',
      });
    }

    await portalRepository.logActivity(
      projectId,
      user.id,
      'FILE_UPLOADED',
      `${file.originalname} was uploaded`,
    );
    return created;
  },

  async updateFile(
    fileId: string,
    requestUser: Express.Request['user'],
    data: {
      name?: string;
      folderId?: string | null;
      visibility?: string;
      deliverableStatus?: string;
    },
  ) {
    const user = toPortalUser(requestUser);
    const file = await portalRepository.findFileById(fileId);
    if (!file) throw notFound('File not found');
    await this.assertProjectAccess(file.projectId, user);
    if (!canManage(user) && data.visibility) {
      throw forbidden('Clients cannot change file visibility');
    }
    const updated = await portalRepository.updateFile(fileId, data);
    await portalRepository.logActivity(
      file.projectId,
      user.id,
      'FILE_UPDATED',
      `${updated.name} was updated`,
    );
    return updated;
  },

  async deleteFile(fileId: string, requestUser: Express.Request['user']) {
    const user = toPortalUser(requestUser);
    const file = await portalRepository.findFileById(fileId);
    if (!file) throw notFound('File not found');
    await this.assertProjectAccess(file.projectId, user);
    if (user.role !== 'ADMIN') {
      throw forbidden('Only admins can delete files');
    }
    await portalRepository.softDeleteFile(fileId);
    await portalRepository.logActivity(
      file.projectId,
      user.id,
      'FILE_DELETED',
      `${file.name} was deleted`,
    );
  },

  async download(fileId: string, requestUser: Express.Request['user']) {
    const user = toPortalUser(requestUser);
    const file = await portalRepository.findFileById(fileId);
    if (!file) throw notFound('File not found');
    await this.assertProjectAccess(file.projectId, user);
    if (user.role === 'CLIENT' && !['CLIENT', 'PUBLIC_LINK'].includes(file.visibility)) {
      throw forbidden('This file is not shared with clients');
    }
    await portalRepository.recordDownload(fileId, user.id);
    const signature = signDownload(fileId);
    await portalRepository.logActivity(
      file.projectId,
      user.id,
      'FILE_DOWNLOADED',
      `${file.name} was downloaded`,
    );
    return { file, downloadUrl: file.url, ...signature };
  },

  async folders(projectId: string, requestUser: Express.Request['user']) {
    const user = toPortalUser(requestUser);
    await this.assertProjectAccess(projectId, user);
    return portalRepository.listFolders(projectId);
  },

  async createFolder(
    requestUser: Express.Request['user'],
    data: { projectId: string; parentFolderId?: string | null; folderName: string },
  ) {
    const user = toPortalUser(requestUser);
    await this.assertProjectAccess(data.projectId, user);
    if (!canManage(user)) throw forbidden('Only agency users can manage folders');
    const folder = await portalRepository.createFolder(data);
    await portalRepository.logActivity(
      data.projectId,
      user.id,
      'FOLDER_CREATED',
      `${data.folderName} folder was created`,
    );
    return folder;
  },

  async updateFolder(
    id: string,
    requestUser: Express.Request['user'],
    data: { folderName?: string; parentFolderId?: string | null },
  ) {
    const user = toPortalUser(requestUser);
    if (!canManage(user)) throw forbidden('Only agency users can manage folders');
    const folder = await prisma.portalFolder.findFirst({ where: { id, deletedAt: null } });
    if (!folder) throw notFound('Folder not found');
    await this.assertProjectAccess(folder.projectId, user);
    return portalRepository.updateFolder(id, data);
  },

  async deleteFolder(id: string, requestUser: Express.Request['user']) {
    const user = toPortalUser(requestUser);
    if (!canManage(user)) throw forbidden('Only agency users can manage folders');
    const folder = await prisma.portalFolder.findFirst({ where: { id, deletedAt: null } });
    if (!folder) throw notFound('Folder not found');
    await this.assertProjectAccess(folder.projectId, user);
    return portalRepository.softDeleteFolder(id);
  },

  async approvals(requestUser: Express.Request['user'], projectId?: string) {
    const user = toPortalUser(requestUser);
    const projects = projectId
      ? [await this.assertProjectAccess(projectId, user)]
      : await portalRepository.listPortalProjects(user);
    return portalRepository.listApprovals({
      projectId: { in: projects.map((project) => project.id) },
    });
  },

  async approve(approvalId: string, requestUser: Express.Request['user'], comments?: string) {
    const user = toPortalUser(requestUser);
    const approval = await portalRepository.findApproval(approvalId);
    if (!approval) throw notFound('Approval not found');
    await this.assertProjectAccess(approval.projectId, user);
    if (user.role !== 'CLIENT' && user.role !== 'ADMIN')
      throw forbidden('Only clients or admins can approve deliverables');
    const updated = await portalRepository.updateApproval(approvalId, {
      status: 'APPROVED',
      ...(comments ? { comments } : {}),
      approvedAt: new Date(),
    });
    await portalRepository.updateFile(approval.deliverableId, {
      deliverableStatus: 'APPROVED',
      visibility: 'CLIENT',
    });
    await portalRepository.logActivity(
      approval.projectId,
      user.id,
      'APPROVAL_GIVEN',
      `${approval.deliverable.name} was approved`,
    );
    return updated;
  },

  async requestRevision(
    approvalId: string,
    requestUser: Express.Request['user'],
    description: string,
    priority = 'MEDIUM',
  ) {
    const user = toPortalUser(requestUser);
    const approval = await portalRepository.findApproval(approvalId);
    if (!approval) throw notFound('Approval not found');
    await this.assertProjectAccess(approval.projectId, user);
    const revision = await portalRepository.createRevision({
      projectId: approval.projectId,
      deliverableId: approval.deliverableId,
      requestedById: user.id,
      description,
      priority,
      status: 'OPEN',
    });
    await portalRepository.updateApproval(approvalId, {
      status: 'REVISION_REQUESTED',
      comments: description,
    });
    await portalRepository.updateFile(approval.deliverableId, {
      deliverableStatus: 'AWAITING_APPROVAL',
    });
    await portalRepository.logActivity(
      approval.projectId,
      user.id,
      'REVISION_REQUESTED',
      `Revision requested for ${approval.deliverable.name}`,
    );
    return revision;
  },

  async revisions(requestUser: Express.Request['user'], projectId?: string) {
    const user = toPortalUser(requestUser);
    const projects = projectId
      ? [await this.assertProjectAccess(projectId, user)]
      : await portalRepository.listPortalProjects(user);
    return portalRepository.listRevisions({
      projectId: { in: projects.map((project) => project.id) },
    });
  },

  async createRevision(
    requestUser: Express.Request['user'],
    data: { projectId: string; deliverableId: string; description: string; priority?: string },
  ) {
    const user = toPortalUser(requestUser);
    await this.assertProjectAccess(data.projectId, user);
    const revision = await portalRepository.createRevision({
      projectId: data.projectId,
      deliverableId: data.deliverableId,
      requestedById: user.id,
      description: data.description,
      priority: data.priority ?? 'MEDIUM',
      status: 'OPEN',
    });
    await portalRepository.logActivity(
      data.projectId,
      user.id,
      'REVISION_REQUESTED',
      'Revision request created',
    );
    return revision;
  },

  async updateRevision(
    id: string,
    requestUser: Express.Request['user'],
    data: { status?: string; priority?: string; description?: string },
  ) {
    const user = toPortalUser(requestUser);
    if (!canManage(user)) throw forbidden('Only agency users can update revision status');
    const revision = await prisma.revisionRequest.findFirst({ where: { id } });
    if (!revision) throw notFound('Revision not found');
    await this.assertProjectAccess(revision.projectId, user);
    return portalRepository.updateRevision(id, data);
  },

  async messages(projectId: string, requestUser: Express.Request['user']) {
    const user = toPortalUser(requestUser);
    await this.assertProjectAccess(projectId, user);
    return portalRepository.listMessages(projectId, user.role !== 'CLIENT');
  },

  async createMessage(
    requestUser: Express.Request['user'],
    data: { projectId: string; body: string; internalOnly?: boolean },
  ) {
    const user = toPortalUser(requestUser);
    await this.assertProjectAccess(data.projectId, user);
    if (user.role === 'CLIENT' && data.internalOnly)
      throw forbidden('Clients cannot create internal messages');
    const message = await portalRepository.createMessage({
      projectId: data.projectId,
      authorId: user.id,
      body: data.body,
      internalOnly: data.internalOnly ?? false,
    });
    await portalRepository.logActivity(
      data.projectId,
      user.id,
      'COMMENT_ADDED',
      'A message was added',
    );
    return message;
  },

  async updateMessage(id: string, requestUser: Express.Request['user'], body: string) {
    const user = toPortalUser(requestUser);
    const message = await portalRepository.findMessage(id);
    if (!message) throw notFound('Message not found');
    await this.assertProjectAccess(message.projectId, user);
    if (message.authorId !== user.id && user.role !== 'ADMIN')
      throw forbidden('You cannot edit this message');
    return portalRepository.updateMessage(id, { body, edited: true });
  },

  async deleteMessage(id: string, requestUser: Express.Request['user']) {
    const user = toPortalUser(requestUser);
    const message = await portalRepository.findMessage(id);
    if (!message) throw notFound('Message not found');
    await this.assertProjectAccess(message.projectId, user);
    if (message.authorId !== user.id && user.role !== 'ADMIN')
      throw forbidden('You cannot delete this message');
    return portalRepository.softDeleteMessage(id);
  },

  async meetings(requestUser: Express.Request['user']) {
    const user = toPortalUser(requestUser);
    const projects = await portalRepository.listPortalProjects(user);
    return portalRepository.listMeetings({
      projectId: { in: projects.map((project) => project.id) },
    });
  },
};
