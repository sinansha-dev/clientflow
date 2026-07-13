import { prisma } from '../config/prisma';
import type { Role } from '@prisma/client';

export interface UserContext {
  id: string;
  email: string;
  role: Role;
}

export const AuthorizationService = {
  /**
   * Resolves the active project role for a user.
   * Checks both explicit ProjectMember records and legacy projectManagerId fields.
   */
  async getMemberRole(projectId: string, userId: string): Promise<string | null> {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
      select: { projectRole: true },
    });
    if (member) return member.projectRole;

    const project = await prisma.project.findFirst({
      where: { id: projectId },
      select: { projectManagerId: true },
    });
    if (project?.projectManagerId === userId) {
      return 'Project Manager';
    }
    return null;
  },

  /**
   * Helper to verify if a user has access to a project.
   */
  async canAccessProject(projectId: string, user: UserContext): Promise<boolean> {
    if (user.role === 'ADMIN') return true;

    if (user.role === 'STAFF') {
      const role = await this.getMemberRole(projectId, user.id);
      return role !== null;
    }

    if (user.role === 'CLIENT') {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
          client: {
            OR: [
              { email: user.email },
              { contacts: { some: { email: user.email } } },
              { portalAccesses: { some: { userId: user.id, status: 'ACTIVE' } } },
            ],
          },
        },
        select: { id: true },
      });
      return !!project;
    }

    return false;
  },

  /**
   * Verify if a user is authorized to manage project settings / status / members.
   */
  async canManageProject(projectId: string, user: UserContext): Promise<boolean> {
    if (user.role === 'ADMIN') return true;
    if (user.role !== 'STAFF') return false;
    const role = await this.getMemberRole(projectId, user.id);
    return role === 'Project Manager';
  },

  /**
   * Verify if a user is authorized to manage members in the project.
   */
  async canManageMembers(projectId: string, user: UserContext): Promise<boolean> {
    return this.canManageProject(projectId, user);
  },

  /**
   * Verify if a user is authorized to create/edit/assign tasks.
   */
  async canAssignTasks(projectId: string, user: UserContext): Promise<boolean> {
    if (user.role === 'ADMIN') return true;
    if (user.role !== 'STAFF') return false;
    const role = await this.getMemberRole(projectId, user.id);
    return role === 'Project Manager' || role === 'Lead Developer';
  },

  /**
   * Verify if a user is authorized to view billing details/invoices.
   */
  async canViewBilling(projectId: string, user: UserContext): Promise<boolean> {
    if (user.role === 'ADMIN') return true;
    if (user.role !== 'STAFF') return false;
    const role = await this.getMemberRole(projectId, user.id);
    return role === 'Project Manager';
  },

  /**
   * Verify if a user is authorized to approve timesheets.
   */
  async canApproveTimesheets(projectId: string, user: UserContext): Promise<boolean> {
    if (user.role === 'ADMIN') return true;
    if (user.role !== 'STAFF') return false;
    const role = await this.getMemberRole(projectId, user.id);
    return role === 'Project Manager';
  },

  /**
   * Central assertions helpers
   */
  async assertProject(projectId: string, user: UserContext): Promise<void> {
    const hasAccess = await this.canAccessProject(projectId, user);
    if (!hasAccess) {
      const { forbidden } = require('../utils/errors');
      throw forbidden('Access denied');
    }
  },

  async assertClient(clientId: string, user: UserContext): Promise<void> {
    const hasAccess = await this.canAccessClient(clientId, user);
    if (!hasAccess) {
      const { forbidden } = require('../utils/errors');
      throw forbidden('Access denied');
    }
  },

  async assertTask(taskId: string, user: UserContext): Promise<void> {
    const hasAccess = await this.canAccessTask(taskId, user);
    if (!hasAccess) {
      const { forbidden } = require('../utils/errors');
      throw forbidden('Access denied');
    }
  },

  async assertInvoice(invoiceId: string, user: UserContext): Promise<void> {
    const hasAccess = await this.canAccessInvoice(invoiceId, user);
    if (!hasAccess) {
      const { forbidden } = require('../utils/errors');
      throw forbidden('Access denied');
    }
  },

  async assertQuotation(quotationId: string, user: UserContext): Promise<void> {
    const hasAccess = await this.canAccessQuotation(quotationId, user);
    if (!hasAccess) {
      const { forbidden } = require('../utils/errors');
      throw forbidden('Access denied');
    }
  },

  async assertPayment(paymentId: string, user: UserContext): Promise<void> {
    const hasAccess = await this.canAccessPayment(paymentId, user);
    if (!hasAccess) {
      const { forbidden } = require('../utils/errors');
      throw forbidden('Access denied');
    }
  },

  async assertExpense(expenseId: string, user: UserContext): Promise<void> {
    const hasAccess = await this.canAccessExpense(expenseId, user);
    if (!hasAccess) {
      const { forbidden } = require('../utils/errors');
      throw forbidden('Access denied');
    }
  },

  /**
   * Helper to verify if a user has access to a client company.
   */
  async canAccessClient(clientId: string, user: UserContext): Promise<boolean> {
    if (user.role === 'ADMIN') return true;

    if (user.role === 'STAFF') {
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          deletedAt: null,
          OR: [
            { assignedManagerId: user.id },
            {
              projects: {
                some: {
                  deletedAt: null,
                  OR: [
                    { projectManagerId: user.id },
                    {
                      projectMembers: {
                        some: {
                          userId: user.id,
                          projectRole: 'Project Manager',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
        select: { id: true },
      });
      return !!client;
    }

    if (user.role === 'CLIENT') {
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          deletedAt: null,
          OR: [
            { email: user.email },
            { contacts: { some: { email: user.email } } },
            { portalAccesses: { some: { userId: user.id, status: 'ACTIVE' } } },
          ],
        },
        select: { id: true },
      });
      return !!client;
    }

    return false;
  },

  /**
   * Helper to verify if a user has access to a specific task.
   */
  async canAccessTask(taskId: string, user: UserContext): Promise<boolean> {
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { projectId: true, status: true },
    });
    if (!task) return false;

    // Check project access first
    const hasProjectAccess = await this.canAccessProject(task.projectId, user);
    if (!hasProjectAccess) return false;

    // Additional CLIENT restriction: Clients can only see completed tasks
    if (user.role === 'CLIENT' && task.status !== 'COMPLETED') {
      return false;
    }

    return true;
  },

  /**
   * Helper to verify if a user has access to a client portal folder.
   */
  async canAccessFolder(folderId: string, user: UserContext): Promise<boolean> {
    const folder = await prisma.portalFolder.findFirst({
      where: { id: folderId, deletedAt: null },
      select: { projectId: true },
    });
    if (!folder) return false;
    return this.canAccessProject(folder.projectId, user);
  },

  /**
   * Helper to verify if a user has access to a specific project file/deliverable.
   */
  async canAccessFile(fileId: string, user: UserContext): Promise<boolean> {
    const file = await prisma.projectFile.findFirst({
      where: { id: fileId, deletedAt: null },
      select: { projectId: true, visibility: true },
    });
    if (!file) return false;

    const hasProjectAccess = await this.canAccessProject(file.projectId, user);
    if (!hasProjectAccess) return false;

    // Clients cannot see INTERNAL visibility files
    if (user.role === 'CLIENT' && file.visibility === 'INTERNAL') {
      return false;
    }

    return true;
  },

  /**
   * Helper to verify if a user has access to a quotation.
   */
  async canAccessQuotation(quotationId: string, user: UserContext): Promise<boolean> {
    const quote = await prisma.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
      select: { clientId: true, projectId: true },
    });
    if (!quote) return false;

    if (user.role === 'ADMIN') return true;

    if (user.role === 'CLIENT') {
      return this.canAccessClient(quote.clientId, user);
    }

    if (user.role === 'STAFF') {
      return quote.projectId ? this.canViewBilling(quote.projectId, user) : false;
    }

    return false;
  },

  /**
   * Helper to verify if a user has access to an invoice.
   */
  async canAccessInvoice(invoiceId: string, user: UserContext): Promise<boolean> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      select: { clientId: true, projectId: true },
    });
    if (!invoice) return false;

    if (user.role === 'ADMIN') return true;

    if (user.role === 'CLIENT') {
      return this.canAccessClient(invoice.clientId, user);
    }

    if (user.role === 'STAFF') {
      return invoice.projectId ? this.canViewBilling(invoice.projectId, user) : false;
    }

    return false;
  },

  /**
   * Helper to verify if a user has access to a payment records.
   */
  async canAccessPayment(paymentId: string, user: UserContext): Promise<boolean> {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId },
      select: { clientId: true, invoiceId: true },
    });
    if (!payment) return false;

    if (user.role === 'ADMIN') return true;

    if (user.role === 'CLIENT') {
      return this.canAccessClient(payment.clientId, user);
    }

    return false; // Staff don't have access to payment ledger details by default
  },

  /**
   * Helper to verify if a user has access to an expense record.
   */
  async canAccessExpense(expenseId: string, user: UserContext): Promise<boolean> {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, deletedAt: null },
      select: { projectId: true },
    });
    if (!expense) return false;

    if (user.role === 'ADMIN') return true;

    if (user.role === 'STAFF') {
      return this.canAccessProject(expense.projectId, user);
    }

    return false; // Clients don't have access to project expenses
  },

  /**
   * Helper to verify if a user has access to a meeting.
   */
  async canAccessMeeting(meetingId: string, user: UserContext): Promise<boolean> {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId },
      select: { projectId: true, organizerId: true },
    });
    if (!meeting) return false;

    if (user.role === 'ADMIN') return true;
    if (meeting.organizerId === user.id) return true;

    // Check if participant
    const participant = await prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId: user.id } },
    });
    if (participant) return true;

    // Check if linked to a project they can access
    if (meeting.projectId) {
      return this.canAccessProject(meeting.projectId, user);
    }

    return false;
  },

  /**
   * Helper to verify if a user can modify a specific time log.
   */
  async canAccessTimeLog(timeLogId: string, user: UserContext): Promise<boolean> {
    const timeLog = await prisma.timeLog.findFirst({
      where: { id: timeLogId },
      select: { userId: true, projectId: true },
    });
    if (!timeLog) return false;

    if (user.role === 'ADMIN') return true;

    if (user.role === 'STAFF') {
      return timeLog.userId === user.id;
    }

    return false;
  },
};
