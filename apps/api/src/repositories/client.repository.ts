import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const clientRepository = {
  async list(
    params: {
      search?: string;
      status?: string;
      industry?: string;
      country?: string;
      managerId?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    },
    currentUser?: { id: string; email: string; role: any },
  ) {
    const {
      search,
      status,
      industry,
      country,
      managerId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {
      deletedAt: null,
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(industry && industry !== 'ALL' ? { industry } : {}),
      ...(country && country !== 'ALL' ? { country } : {}),
      ...(currentUser?.role === 'STAFF'
        ? {
            OR: [
              { assignedManagerId: currentUser.id },
              {
                projects: {
                  some: {
                    deletedAt: null,
                    OR: [
                      { projectManagerId: currentUser.id },
                      { projectMembers: { some: { userId: currentUser.id } } },
                    ],
                  },
                },
              },
            ],
          }
        : {
            ...(managerId && managerId !== 'ALL' ? { assignedManagerId: managerId } : {}),
          }),
      ...(currentUser?.role === 'CLIENT'
        ? {
            OR: [
              { email: currentUser.email },
              { contacts: { some: { email: currentUser.email } } },
              { portalAccesses: { some: { userId: currentUser.id, status: 'ACTIVE' } } },
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { industry: { contains: search, mode: 'insensitive' } },
              {
                contacts: {
                  some: {
                    name: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        include: {
          assignedManager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          contacts: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  },

  async findById(id: string, currentUser?: { id: string; email: string; role: any }) {
    if (currentUser) {
      const { AuthorizationService } = require('../services/authorization.service');
      const hasAccess = await AuthorizationService.canAccessClient(id, currentUser);
      if (!hasAccess) return null;
    }

    let invoiceWhere: Prisma.InvoiceWhereInput = { deletedAt: null };
    let quotationWhere: Prisma.QuotationWhereInput = { deletedAt: null };

    if (currentUser && currentUser.role === 'STAFF') {
      const clientRecord = await prisma.client.findFirst({
        where: { id, deletedAt: null },
        select: { assignedManagerId: true },
      });
      const isManager = clientRecord?.assignedManagerId === currentUser.id;

      if (!isManager) {
        const projectIds = await prisma.projectMember
          .findMany({
            where: { userId: currentUser.id },
            select: { projectId: true },
          })
          .then((pts: { projectId: string }[]) =>
            pts.map((pt: { projectId: string }) => pt.projectId),
          );

        invoiceWhere = { deletedAt: null, projectId: { in: projectIds } };
        quotationWhere = { deletedAt: null, projectId: { in: projectIds } };
      }
    } else if (currentUser && currentUser.role === 'CLIENT') {
      const accesses = await prisma.clientPortalAccess
        .findMany({
          where: { userId: currentUser.id, status: 'ACTIVE' },
          select: { clientId: true },
        })
        .then((acc) => acc.map((a) => a.clientId));

      invoiceWhere = { deletedAt: null, clientId: { in: accesses } };
      quotationWhere = { deletedAt: null, clientId: { in: accesses } };
    }

    return prisma.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignedManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        contacts: {
          orderBy: { createdAt: 'asc' },
        },
        notes: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        files: {
          orderBy: { createdAt: 'desc' },
        },
        projects: {
          where: { deletedAt: null },
          include: {
            projectManager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
            timeLogs: {
              where: { status: 'APPROVED', endTime: { not: null } },
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    hourlyRate: true,
                  },
                },
              },
              orderBy: { startTime: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          where: invoiceWhere,
          include: { project: true, payments: true },
          orderBy: { createdAt: 'desc' },
        },
        quotations: {
          where: quotationWhere,
          include: { project: true, items: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },

  async create(data: Prisma.ClientCreateInput) {
    return prisma.client.create({
      data,
      include: {
        contacts: true,
      },
    });
  },

  async update(id: string, data: Prisma.ClientUpdateInput) {
    return prisma.client.update({
      where: { id },
      data,
      include: {
        contacts: true,
      },
    });
  },

  async archive(id: string) {
    return prisma.client.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
  },

  async restore(id: string) {
    return prisma.client.update({
      where: { id },
      data: { status: 'ACTIVE', archivedAt: null },
    });
  },

  async softDelete(id: string) {
    const deletedClient = await prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Cascade soft-delete to client's projects
    const projects = await prisma.project.findMany({
      where: { clientId: id, deletedAt: null },
      select: { id: true },
    });

    const { projectRepository } = require('./project.repository');
    for (const project of projects) {
      await projectRepository.softDelete(project.id);
    }

    return deletedClient;
  },

  async checkDuplicateName(companyName: string, exceptId?: string) {
    const client = await prisma.client.findFirst({
      where: {
        companyName,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    return Boolean(client);
  },

  // Contact operations
  async addContact(clientId: string, data: Prisma.ClientContactCreateWithoutClientInput) {
    if (data.primaryContact) {
      // Unset other primary contacts
      await prisma.clientContact.updateMany({
        where: { clientId, primaryContact: true },
        data: { primaryContact: false },
      });
    }
    return prisma.clientContact.create({
      data: {
        ...data,
        clientId,
      },
    });
  },

  async updateContact(id: string, clientId: string, data: Prisma.ClientContactUpdateInput) {
    if (data.primaryContact === true) {
      await prisma.clientContact.updateMany({
        where: { clientId, id: { not: id }, primaryContact: true },
        data: { primaryContact: false },
      });
    }
    return prisma.clientContact.update({
      where: { id },
      data,
    });
  },

  async deleteContact(id: string) {
    return prisma.clientContact.delete({
      where: { id },
    });
  },

  // Note operations
  async addNote(clientId: string, userId: string, note: string) {
    return prisma.clientNote.create({
      data: {
        clientId,
        userId,
        note,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });
  },

  async updateNote(id: string, note: string) {
    return prisma.clientNote.update({
      where: { id },
      data: { note },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });
  },

  async deleteNote(id: string) {
    return prisma.clientNote.delete({
      where: { id },
    });
  },

  async findNoteById(id: string) {
    return prisma.clientNote.findFirst({
      where: { id },
    });
  },

  // File operations
  async addFile(clientId: string, data: { name: string; type: string; size: number; url: string }) {
    return prisma.clientFile.create({
      data: {
        ...data,
        clientId,
      },
    });
  },

  async deleteFile(id: string) {
    return prisma.clientFile.delete({
      where: { id },
    });
  },

  async findFileById(id: string) {
    return prisma.clientFile.findFirst({
      where: { id },
    });
  },

  // Activity tracking helper
  async logActivity(clientId: string, type: string, description: string) {
    return prisma.clientActivity.create({
      data: {
        clientId,
        type,
        description,
      },
    });
  },
};
