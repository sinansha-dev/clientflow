import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
  role: true,
} satisfies Prisma.UserSelect;

const projectListInclude = {
  client: { select: { id: true, companyName: true, email: true } },
  projectManager: { select: userSelect },
  milestones: { orderBy: { dueDate: 'asc' as const } },
  files: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' as const }, take: 5 },
  meetingsLinked: { orderBy: { startTime: 'asc' as const }, take: 5 },
  portalMessages: {
    where: { deletedAt: null, internalOnly: false },
    orderBy: { createdAt: 'desc' as const },
    take: 5,
    include: { author: { select: userSelect } },
  },
} satisfies Prisma.ProjectInclude;

export const portalRepository = {
  userSelect,

  projectAccessWhere(userId: string, email: string, role: Role): Prisma.ProjectWhereInput {
    if (role === 'ADMIN') {
      return { deletedAt: null };
    }

    if (role === 'STAFF') {
      return {
        deletedAt: null,
        OR: [{ projectManagerId: userId }, { projectMembers: { some: { userId } } }],
      };
    }

    return {
      deletedAt: null,
      client: {
        OR: [
          { email },
          { contacts: { some: { email } } },
          { portalAccesses: { some: { userId, status: 'ACTIVE' } } },
        ],
      },
    };
  },

  async canAccessProject(projectId: string, user: { id: string; email: string; role: Role }) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, ...this.projectAccessWhere(user.id, user.email, user.role) },
      select: { id: true, clientId: true, projectName: true },
    });
    return project;
  },

  async listPortalProjects(user: { id: string; email: string; role: Role }) {
    return prisma.project.findMany({
      where: this.projectAccessWhere(user.id, user.email, user.role),
      include: projectListInclude,
      orderBy: { updatedAt: 'desc' },
    });
  },

  async getPortalProject(projectId: string) {
    return prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        ...projectListInclude,
        projectMembers: { include: { user: { select: userSelect } } },
        portalFolders: { where: { deletedAt: null }, orderBy: { folderName: 'asc' } },
        deliverableApprovals: { orderBy: { createdAt: 'desc' }, include: { deliverable: true } },
        revisionRequests: {
          orderBy: { createdAt: 'desc' },
          include: { deliverable: true, requestedBy: { select: userSelect } },
        },
        portalActivities: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: { user: { select: userSelect } },
        },
        invoices: {
          where: { deletedAt: null },
          orderBy: { issueDate: 'desc' },
          include: { payments: true },
        },
        quotations: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },

  async listProjectFiles(projectId: string, clientVisibleOnly: boolean) {
    return prisma.projectFile.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(clientVisibleOnly ? { visibility: { in: ['CLIENT', 'PUBLIC_LINK'] } } : {}),
      },
      include: {
        uploadedBy: { select: userSelect },
        folderNode: true,
        versions: { orderBy: { version: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createFile(data: Prisma.ProjectFileUncheckedCreateInput) {
    return prisma.projectFile.create({
      data,
      include: { uploadedBy: { select: userSelect }, folderNode: true },
    });
  },

  async createFileVersion(data: Prisma.ProjectFileVersionUncheckedCreateInput) {
    return prisma.projectFileVersion.create({ data });
  },

  async updateFile(id: string, data: Prisma.ProjectFileUpdateInput) {
    return prisma.projectFile.update({
      where: { id },
      data,
      include: { uploadedBy: { select: userSelect }, folderNode: true },
    });
  },

  async findFileById(id: string) {
    return prisma.projectFile.findFirst({
      where: { id, deletedAt: null },
      include: { project: { select: { id: true, clientId: true } } },
    });
  },

  async softDeleteFile(id: string) {
    return prisma.projectFile.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async recordDownload(fileId: string, userId: string) {
    return prisma.$transaction([
      prisma.fileDownload.create({ data: { fileId, userId } }),
      prisma.projectFile.update({
        where: { id: fileId },
        data: { downloadCount: { increment: 1 } },
      }),
    ]);
  },

  async listFolders(projectId: string) {
    return prisma.portalFolder.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { folderName: 'asc' },
    });
  },

  async createFolder(data: Prisma.PortalFolderUncheckedCreateInput) {
    return prisma.portalFolder.create({ data });
  },

  async updateFolder(id: string, data: Prisma.PortalFolderUpdateInput) {
    return prisma.portalFolder.update({ where: { id }, data });
  },

  async softDeleteFolder(id: string) {
    return prisma.portalFolder.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async listApprovals(where: Prisma.DeliverableApprovalWhereInput) {
    return prisma.deliverableApproval.findMany({
      where,
      include: { project: true, deliverable: true, client: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createApproval(data: Prisma.DeliverableApprovalUncheckedCreateInput) {
    return prisma.deliverableApproval.create({ data, include: { deliverable: true } });
  },

  async findApproval(id: string) {
    return prisma.deliverableApproval.findUnique({
      where: { id },
      include: { deliverable: true, project: true },
    });
  },

  async updateApproval(id: string, data: Prisma.DeliverableApprovalUpdateInput) {
    return prisma.deliverableApproval.update({
      where: { id },
      data,
      include: { deliverable: true },
    });
  },

  async listRevisions(where: Prisma.RevisionRequestWhereInput) {
    return prisma.revisionRequest.findMany({
      where,
      include: { project: true, deliverable: true, requestedBy: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createRevision(data: Prisma.RevisionRequestUncheckedCreateInput) {
    return prisma.revisionRequest.create({
      data,
      include: { deliverable: true, requestedBy: { select: userSelect } },
    });
  },

  async updateRevision(id: string, data: Prisma.RevisionRequestUpdateInput) {
    return prisma.revisionRequest.update({ where: { id }, data, include: { deliverable: true } });
  },

  async listMessages(projectId: string, includeInternal: boolean) {
    return prisma.portalMessage.findMany({
      where: { projectId, deletedAt: null, ...(includeInternal ? {} : { internalOnly: false }) },
      include: { author: { select: userSelect }, attachments: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  async createMessage(data: Prisma.PortalMessageUncheckedCreateInput) {
    return prisma.portalMessage.create({
      data,
      include: { author: { select: userSelect }, attachments: true },
    });
  },

  async findMessage(id: string) {
    return prisma.portalMessage.findFirst({ where: { id, deletedAt: null } });
  },

  async updateMessage(id: string, data: Prisma.PortalMessageUpdateInput) {
    return prisma.portalMessage.update({
      where: { id },
      data,
      include: { author: { select: userSelect }, attachments: true },
    });
  },

  async softDeleteMessage(id: string) {
    return prisma.portalMessage.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async listMeetings(where: Prisma.MeetingWhereInput) {
    return prisma.meeting.findMany({
      where,
      include: { project: true, participants: { include: { user: { select: userSelect } } } },
      orderBy: { startTime: 'asc' },
    });
  },

  async logActivity(projectId: string, userId: string | null, type: string, description: string) {
    return prisma.portalActivity.create({ data: { projectId, userId, type, description } });
  },
};
