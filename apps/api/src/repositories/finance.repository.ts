import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';

const money = (value: number) => Math.round(value * 100) / 100;

type LineItemInput = {
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
};

type FinanceUser = { id: string; role: Role };

function totals(items: LineItemInput[] = [], discount = 0) {
  const normalized = items.length
    ? items
    : [{ name: 'Service', quantity: 1, unitPrice: 0, taxRate: 0 }];
  const prepared = normalized.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const taxRate = Number(item.taxRate) || 0;
    const base = quantity * unitPrice;
    return { ...item, quantity, unitPrice, taxRate, total: money(base + base * (taxRate / 100)) };
  });
  const subtotal = money(prepared.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const tax = money(
    prepared.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate / 100), 0),
  );
  const total = money(Math.max(subtotal + tax - (Number(discount) || 0), 0));
  return { items: prepared, subtotal, tax, total, discount: money(Number(discount) || 0) };
}

async function nextNumber(prefix: 'QTN' | 'INV') {
  const year = new Date().getFullYear();
  const prefixPattern = `${prefix}-${year}-`;

  if (prefix === 'QTN') {
    const latest = await prisma.quotation.findFirst({
      where: { quoteNumber: { startsWith: prefixPattern } },
      orderBy: { quoteNumber: 'desc' },
    });
    if (!latest) {
      return `${prefixPattern}0001`;
    }
    const lastNumStr = latest.quoteNumber.replace(prefixPattern, '');
    const lastNum = parseInt(lastNumStr, 10);
    const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
    return `${prefixPattern}${String(nextNum).padStart(4, '0')}`;
  } else {
    const latest = await prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefixPattern } },
      orderBy: { invoiceNumber: 'desc' },
    });
    if (!latest) {
      return `${prefixPattern}0001`;
    }
    const lastNumStr = latest.invoiceNumber.replace(prefixPattern, '');
    const lastNum = parseInt(lastNumStr, 10);
    const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
    return `${prefixPattern}${String(nextNum).padStart(4, '0')}`;
  }
}

async function clientIdsForUser(user: FinanceUser) {
  if (user.role !== 'CLIENT') return undefined;
  const accesses = await prisma.clientPortalAccess.findMany({
    where: { userId: user.id, status: 'ACTIVE' },
    select: { clientId: true },
  });
  return accesses.map((access) => access.clientId);
}

async function projectIdsForStaff(user: FinanceUser) {
  if (user.role !== 'STAFF') return undefined;
  const projects = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });
  return projects.map((project: { projectId: string }) => project.projectId);
}

async function visibilityWhere(user: FinanceUser, base: Prisma.QuotationWhereInput = {}) {
  if (user.role === 'CLIENT') {
    const clientIds = await clientIdsForUser(user);
    return { ...base, clientId: { in: clientIds ?? [] } };
  }
  if (user.role === 'STAFF') {
    const projectIds = await projectIdsForStaff(user);
    return { ...base, projectId: { in: projectIds ?? [] } };
  }
  return base;
}

async function invoiceVisibilityWhere(user: FinanceUser, base: Prisma.InvoiceWhereInput = {}) {
  if (user.role === 'CLIENT') {
    const clientIds = await clientIdsForUser(user);
    return { ...base, clientId: { in: clientIds ?? [] } };
  }
  if (user.role === 'STAFF') {
    const projectIds = await projectIdsForStaff(user);
    return { ...base, projectId: { in: projectIds ?? [] } };
  }
  return base;
}

const quoteInclude = {
  client: true,
  project: true,
  items: true,
  creator: true,
} satisfies Prisma.QuotationInclude;
const invoiceInclude = {
  client: true,
  project: true,
  items: true,
  payments: true,
  creator: true,
} satisfies Prisma.InvoiceInclude;
const paymentInclude = {
  invoice: { include: { project: true } },
  client: true,
  recorder: true,
} satisfies Prisma.PaymentInclude;
const expenseInclude = {
  project: { include: { client: true } },
  recorder: true,
} satisfies Prisma.ExpenseInclude;

export const financeRepository = {
  async listQuotations(
    user: FinanceUser,
    filters: { clientId?: string; projectId?: string; status?: string },
  ) {
    const base: Prisma.QuotationWhereInput = { deletedAt: null };
    if (filters.clientId) base.clientId = filters.clientId;
    if (filters.projectId) base.projectId = filters.projectId;
    if (filters.status) base.status = filters.status;
    const where = await visibilityWhere(user, base);
    return prisma.quotation.findMany({
      where,
      include: quoteInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  async createQuotation(userId: string, data: any) {
    const calculated = totals(data.items, data.discount);
    return prisma.quotation.create({
      data: {
        quoteNumber: await nextNumber('QTN'),
        clientId: data.clientId,
        projectId: data.projectId || null,
        title: data.title,
        description: data.description || null,
        quoteDate: data.quoteDate ? new Date(data.quoteDate) : new Date(),
        validUntil: new Date(data.validUntil),
        currency: data.currency || 'USD',
        status: data.status || 'DRAFT',
        subtotal: calculated.subtotal,
        tax: calculated.tax,
        discount: calculated.discount,
        total: calculated.total,
        notes: data.notes || null,
        scope: data.scope || null,
        termsConditions: data.termsConditions || null,
        internalNotes: data.internalNotes || null,
        billingPlanDraft: data.billingPlanDraft ?? null,
        attachments: data.attachments ?? null,
        createdBy: userId,
        items: { create: calculated.items },
      },
      include: quoteInclude,
    });
  },

  async updateQuotation(id: string, data: any, currentUser?: FinanceUser) {
    if (currentUser) {
      const { AuthorizationService } = require('../services/authorization.service');
      const hasAccess = await AuthorizationService.canAccessQuotation(id, currentUser);
      if (!hasAccess) return null;
    }
    const { items, ...rest } = data;
    const existing = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });
    if (!existing) return null;
    const calculated = items ? totals(items, rest.discount ?? existing.discount) : null;
    return prisma.$transaction(async (tx) => {
      if (calculated) {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      }
      return tx.quotation.update({
        where: { id },
        data: {
          ...rest,
          quoteDate: rest.quoteDate ? new Date(rest.quoteDate) : undefined,
          validUntil: rest.validUntil ? new Date(rest.validUntil) : undefined,
          projectId: rest.projectId === '' ? null : rest.projectId,
          subtotal: calculated?.subtotal,
          tax: calculated?.tax,
          discount: calculated?.discount,
          total: calculated?.total,
          items: calculated ? { create: calculated.items } : undefined,
        },
        include: quoteInclude,
      });
    });
  },

  async deleteQuotation(id: string, currentUser?: FinanceUser) {
    if (currentUser) {
      const { AuthorizationService } = require('../services/authorization.service');
      const hasAccess = await AuthorizationService.canAccessQuotation(id, currentUser);
      if (!hasAccess) return null;
    }
    return prisma.quotation.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async setQuotationStatus(id: string, status: string, currentUser?: FinanceUser) {
    if (currentUser) {
      const { AuthorizationService } = require('../services/authorization.service');
      const hasAccess = await AuthorizationService.canAccessQuotation(id, currentUser);
      if (!hasAccess) return null;
    }
    return prisma.quotation.update({ where: { id }, data: { status }, include: quoteInclude });
  },

  async convertQuotationToInvoice(id: string, userId: string) {
    const quote = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: { items: true, client: true },
    });
    if (!quote) return null;
    const due = new Date();
    due.setDate(due.getDate() + 30);
    return prisma.invoice.create({
      data: {
        invoiceNumber: await nextNumber('INV'),
        clientId: quote.clientId,
        projectId: quote.projectId,
        issueDate: new Date(),
        dueDate: due,
        status: 'DRAFT',
        currency: quote.client.currency,
        subtotal: quote.subtotal,
        tax: quote.tax,
        discount: quote.discount,
        total: quote.total,
        balanceDue: quote.total,
        notes: quote.notes,
        createdBy: userId,
        items: {
          create: quote.items.map(({ name, description, quantity, unitPrice, taxRate, total }) => ({
            name,
            description,
            quantity,
            unitPrice,
            taxRate,
            total,
          })),
        },
      },
      include: invoiceInclude,
    });
  },

  async listInvoices(
    user: FinanceUser,
    filters: { clientId?: string; projectId?: string; status?: string },
  ) {
    const base: Prisma.InvoiceWhereInput = { deletedAt: null };
    if (filters.clientId) base.clientId = filters.clientId;
    if (filters.projectId) base.projectId = filters.projectId;
    if (filters.status) base.status = filters.status;
    const where = await invoiceVisibilityWhere(user, base);
    return prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  async createInvoice(userId: string, data: any) {
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    const calculated = totals(data.items, data.discount);
    return prisma.invoice.create({
      data: {
        invoiceNumber: await nextNumber('INV'),
        clientId: data.clientId,
        projectId: data.projectId || null,
        title: data.title || 'Invoice',
        scope: data.scope || null,
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        status: data.status || 'DRAFT',
        currency: data.currency || client?.currency || 'USD',
        subtotal: calculated.subtotal,
        tax: calculated.tax,
        discount: calculated.discount,
        total: calculated.total,
        balanceDue: calculated.total,
        notes: data.notes || null,
        termsConditions: data.termsConditions || null,
        internalNotes: data.internalNotes || null,
        attachments: data.attachments ?? null,
        paymentMethod: data.paymentMethod || null,
        paymentInstructions: data.paymentInstructions || null,
        createdBy: userId,
        items: { create: calculated.items },
      },
      include: invoiceInclude,
    });
  },

  async updateInvoice(id: string, data: any, currentUser?: FinanceUser) {
    if (currentUser) {
      const { AuthorizationService } = require('../services/authorization.service');
      const hasAccess = await AuthorizationService.canAccessInvoice(id, currentUser);
      if (!hasAccess) return null;
    }
    const { items, ...rest } = data;
    const existing = await prisma.invoice.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    const calculated = items ? totals(items, rest.discount ?? existing.discount) : null;
    return prisma.$transaction(async (tx) => {
      if (calculated) await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          ...rest,
          issueDate: rest.issueDate ? new Date(rest.issueDate) : undefined,
          dueDate: rest.dueDate ? new Date(rest.dueDate) : undefined,
          projectId: rest.projectId === '' ? null : rest.projectId,
          subtotal: calculated?.subtotal,
          tax: calculated?.tax,
          discount: calculated?.discount,
          total: calculated?.total,
          balanceDue: calculated ? money(calculated.total - existing.amountPaid) : undefined,
          items: calculated ? { create: calculated.items } : undefined,
        },
        include: invoiceInclude,
      });
    });
  },

  async deleteInvoice(id: string, currentUser?: FinanceUser) {
    if (currentUser) {
      const { AuthorizationService } = require('../services/authorization.service');
      const hasAccess = await AuthorizationService.canAccessInvoice(id, currentUser);
      if (!hasAccess) return null;
    }
    return prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async setInvoiceStatus(id: string, status: string, currentUser?: FinanceUser) {
    if (currentUser) {
      const { AuthorizationService } = require('../services/authorization.service');
      const hasAccess = await AuthorizationService.canAccessInvoice(id, currentUser);
      if (!hasAccess) return null;
    }
    return prisma.invoice.update({ where: { id }, data: { status }, include: invoiceInclude });
  },

  async listPayments(user: FinanceUser, filters: { clientId?: string; invoiceId?: string }) {
    if (user.role === 'STAFF') return [];
    const clientIds = await clientIdsForUser(user);
    const where: Prisma.PaymentWhereInput = {};
    if (user.role === 'CLIENT') where.clientId = { in: clientIds ?? [] };
    else if (filters.clientId) where.clientId = filters.clientId;
    if (filters.invoiceId) where.invoiceId = filters.invoiceId;
    return prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { paymentDate: 'desc' },
    });
  },

  async createPayment(userId: string, data: any) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, deletedAt: null },
    });
    if (!invoice) return null;
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        amount: Number(data.amount),
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber || null,
        paymentDate: new Date(data.paymentDate),
        notes: data.notes || null,
        recordedBy: userId,
      },
      include: paymentInclude,
    });
    await this.recalculateInvoice(invoice.id);
    return payment;
  },

  async updatePayment(id: string, data: any) {
    const updateData: Prisma.PaymentUpdateInput = {};
    if (data.amount !== undefined) updateData.amount = Number(data.amount);
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.referenceNumber !== undefined) updateData.referenceNumber = data.referenceNumber;
    if (data.paymentDate) updateData.paymentDate = new Date(data.paymentDate);
    if (data.notes !== undefined) updateData.notes = data.notes;
    const payment = await prisma.payment.update({
      where: { id },
      data: updateData,
      include: paymentInclude,
    });
    await this.recalculateInvoice(payment.invoiceId);
    return payment;
  },

  async recalculateInvoice(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (!invoice) return null;
    const amountPaid = money(invoice.payments.reduce((sum, payment) => sum + payment.amount, 0));
    const balanceDue = money(Math.max(invoice.total - amountPaid, 0));
    const status =
      balanceDue <= 0
        ? 'PAID'
        : amountPaid > 0
          ? 'PARTIALLY_PAID'
          : invoice.status === 'DRAFT'
            ? 'DRAFT'
            : new Date(invoice.dueDate) < new Date()
              ? 'OVERDUE'
              : 'SENT';
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid, balanceDue, status },
    });
  },

  async listExpenses(user: FinanceUser, filters: { projectId?: string }) {
    if (user.role === 'CLIENT') return [];
    const projectIds = await projectIdsForStaff(user);
    const where: Prisma.ExpenseWhereInput = { deletedAt: null };
    if (user.role === 'STAFF') where.projectId = { in: projectIds ?? [] };
    else if (filters.projectId) where.projectId = filters.projectId;
    return prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: { expenseDate: 'desc' },
    });
  },

  async createExpense(userId: string, data: any, currentUser?: FinanceUser) {
    if (currentUser) {
      const { AuthorizationService } = require('../services/authorization.service');
      const hasAccess = await AuthorizationService.canAccessProject(data.projectId, currentUser);
      if (!hasAccess) {
        const { forbidden } = require('../utils/errors');
        throw forbidden('Unauthorized project access');
      }
    }
    return prisma.expense.create({
      data: {
        projectId: data.projectId,
        category: data.category,
        amount: Number(data.amount),
        description: data.description,
        receiptUrl: data.receiptUrl || null,
        expenseDate: new Date(data.expenseDate),
        recordedBy: userId,
      },
      include: expenseInclude,
    });
  },

  async updateExpense(id: string, data: any, currentUser?: FinanceUser) {
    if (currentUser) {
      const { AuthorizationService } = require('../services/authorization.service');
      const hasAccess = await AuthorizationService.canAccessExpense(id, currentUser);
      if (!hasAccess) return null;
    }
    return prisma.expense.update({
      where: { id },
      data: { ...data, expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined },
      include: expenseInclude,
    });
  },

  async deleteExpense(id: string, currentUser?: FinanceUser) {
    if (currentUser) {
      const { AuthorizationService } = require('../services/authorization.service');
      const hasAccess = await AuthorizationService.canAccessExpense(id, currentUser);
      if (!hasAccess) return null;
    }
    return prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async financeReport() {
    const [invoices, payments, expenses, quotations] = await Promise.all([
      prisma.invoice.findMany({ where: { deletedAt: null } }),
      prisma.payment.findMany(),
      prisma.expense.findMany({ where: { deletedAt: null } }),
      prisma.quotation.findMany({ where: { deletedAt: null } }),
    ]);
    const revenue = money(payments.reduce((sum, payment) => sum + payment.amount, 0));
    const outstanding = money(invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0));
    const expenseTotal = money(expenses.reduce((sum, expense) => sum + expense.amount, 0));
    return {
      revenue,
      outstanding,
      expenses: expenseTotal,
      profit: money(revenue - expenseTotal),
      draftQuotes: quotations.filter((quote) => quote.status === 'DRAFT').length,
      openInvoices: invoices.filter((invoice) => !['PAID', 'CANCELLED'].includes(invoice.status))
        .length,
    };
  },

  // --- Billing Plans & Stages ---
  async getBillingPlan(projectId: string) {
    return prisma.billingPlan.findUnique({
      where: { projectId },
      include: {
        stages: {
          include: {
            invoice: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  async createOrUpdateBillingPlan(projectId: string, data: any) {
    const { billingType, totalAmount, stages } = data;

    if (!stages || stages.length === 0) {
      await prisma.billingPlan.deleteMany({
        where: { projectId },
      });
      return null;
    }

    const plan = await prisma.billingPlan.upsert({
      where: { projectId },
      create: {
        projectId,
        billingType,
        totalAmount: Number(totalAmount),
      },
      update: {
        billingType,
        totalAmount: Number(totalAmount),
      },
    });

    const existingStages = await prisma.billingStage.findMany({
      where: { billingPlanId: plan.id },
      include: { invoice: true },
    });

    const activeStageIds = stages.map((s: any) => s.id).filter(Boolean);
    const stagesToDelete = existingStages.filter((es) => !activeStageIds.includes(es.id));

    if (stagesToDelete.length > 0) {
      await prisma.billingStage.deleteMany({
        where: { id: { in: stagesToDelete.map((s) => s.id) } },
      });
    }

    for (const stage of stages) {
      const stageAmount = Number(stage.amount);
      if (stage.id) {
        const es = existingStages.find((x) => x.id === stage.id);
        if (es && !es.invoice) {
          await prisma.billingStage.update({
            where: { id: stage.id },
            data: {
              name: stage.name,
              amount: stageAmount,
              dueDate: stage.dueDate ? new Date(stage.dueDate) : null,
              status: stage.status || 'PENDING',
            },
          });
        } else if (es) {
          await prisma.billingStage.update({
            where: { id: stage.id },
            data: {
              name: stage.name,
              dueDate: stage.dueDate ? new Date(stage.dueDate) : null,
            },
          });
        }
      } else {
        await prisma.billingStage.create({
          data: {
            billingPlanId: plan.id,
            name: stage.name,
            amount: stageAmount,
            dueDate: stage.dueDate ? new Date(stage.dueDate) : null,
            status: 'PENDING',
          },
        });
      }
    }

    return this.getBillingPlan(projectId);
  },

  async generateInvoiceForStage(projectId: string, stageId: string, userId: string) {
    const stage = await prisma.billingStage.findUnique({
      where: { id: stageId },
      include: { invoice: true, billingPlan: { include: { project: true } } },
    });

    if (!stage) throw new Error('Billing stage not found');
    if (stage.invoice) return stage.invoice;

    const project = stage.billingPlan.project;
    const client = await prisma.client.findUnique({ where: { id: project.clientId } });
    if (!client) throw new Error('Client not found');

    const due = new Date();
    due.setDate(due.getDate() + 30);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: await nextNumber('INV'),
        clientId: project.clientId,
        projectId: project.id,
        billingStageId: stage.id,
        issueDate: new Date(),
        dueDate: due,
        status: 'DRAFT',
        currency: client.currency,
        subtotal: stage.amount,
        tax: 0,
        discount: 0,
        total: stage.amount,
        balanceDue: stage.amount,
        notes: `Invoice generated for billing stage: ${stage.name}`,
        createdBy: userId,
        items: {
          create: [
            {
              name: stage.name,
              description: `Project billing milestone for ${project.projectName}`,
              quantity: 1,
              unitPrice: stage.amount,
              taxRate: 0,
              total: stage.amount,
            },
          ],
        },
      },
    });

    await prisma.billingStage.update({
      where: { id: stageId },
      data: { status: 'INVOICED' },
    });

    return invoice;
  },

  // --- Recurring Services ---
  async listRecurringServices() {
    return prisma.recurringService.findMany({
      include: {
        project: {
          include: {
            client: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createRecurringService(projectId: string, data: any) {
    const { name, amount, interval, startDate } = data;
    const start = new Date(startDate);

    return prisma.recurringService.create({
      data: {
        projectId,
        name,
        amount: Number(amount),
        interval,
        startDate: start,
        nextInvoiceDate: start,
        status: 'ACTIVE',
      },
    });
  },

  async updateRecurringServiceStatus(id: string, status: any) {
    return prisma.recurringService.update({
      where: { id },
      data: { status },
    });
  },

  async triggerRecurringCron(userId: string) {
    const now = new Date();

    const services = await prisma.recurringService.findMany({
      where: {
        status: 'ACTIVE',
        nextInvoiceDate: { lte: now },
      },
      include: {
        project: {
          include: {
            client: true,
          },
        },
      },
    });

    const generatedInvoices = [];

    for (const service of services) {
      const project = service.project;
      const client = project.client;

      const due = new Date();
      due.setDate(due.getDate() + 30);

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: await nextNumber('INV'),
          clientId: project.clientId,
          projectId: project.id,
          issueDate: now,
          dueDate: due,
          status: 'DRAFT',
          currency: client.currency,
          subtotal: service.amount,
          tax: 0,
          discount: 0,
          total: service.amount,
          balanceDue: service.amount,
          notes: `Automatic invoice generated for recurring service: ${service.name}`,
          createdBy: userId,
          items: {
            create: [
              {
                name: service.name,
                description: `Recurring billing cycle renewal`,
                quantity: 1,
                unitPrice: service.amount,
                taxRate: 0,
                total: service.amount,
              },
            ],
          },
        },
      });

      const nextDate = new Date(service.nextInvoiceDate);
      if (service.interval === 'DAILY') {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (service.interval === 'WEEKLY') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (service.interval === 'MONTHLY') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (service.interval === 'YEARLY') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }

      await prisma.recurringService.update({
        where: { id: service.id },
        data: {
          lastInvoicedDate: now,
          nextInvoiceDate: nextDate,
        },
      });

      generatedInvoices.push(invoice);
    }

    return generatedInvoices;
  },

  // --- Quotation approved project conversion ---
  async convertQuotationToProject(id: string, userId: string) {
    const quote = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: { client: true },
    });

    if (!quote) throw new Error('Quotation not found');
    if (quote.projectId) {
      return prisma.project.findUnique({ where: { id: quote.projectId } });
    }

    const count = await prisma.project.count();
    const projectCode = `PRJ-${String(count + 1).padStart(4, '0')}`;

    const now = new Date();
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 90);

    // Parse the billing plan draft stored on the quotation
    const draft = quote.billingPlanDraft as {
      billingType: string;
      stages: { name: string; percentage: number; amount: number; dueDate?: string | null }[];
      monthlyAmount?: number | null;
      retainerStart?: string | null;
      retainerDuration?: number | null;
    } | null;

    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          projectName: quote.title,
          projectCode,
          description: quote.description || 'Project created from quotation',
          status: 'PLANNING',
          priority: 'MEDIUM',
          budget: quote.total,
          estimatedHours: 100,
          startDate: now,
          deadline,
          clientId: quote.clientId,
          projectManagerId: userId,
          createdBy: userId,
        },
      });

      await tx.quotation.update({
        where: { id },
        data: { projectId: project.id, status: 'ACCEPTED' },
      });

      // Auto-activate billing plan from quotation draft, fallback to CUSTOM
      const billingType = (draft?.billingType as any) || 'CUSTOM';
      const billingPlan = await tx.billingPlan.create({
        data: {
          projectId: project.id,
          billingType,
          totalAmount: quote.total,
        },
      });

      // Create billing stages from draft
      if (draft?.stages && draft.stages.length > 0) {
        for (const stage of draft.stages) {
          await tx.billingStage.create({
            data: {
              billingPlanId: billingPlan.id,
              name: stage.name,
              amount: money(stage.amount),
              dueDate: stage.dueDate ? new Date(stage.dueDate) : null,
              status: 'PENDING',
            },
          });
        }
      } else if (draft?.monthlyAmount) {
        // Monthly retainer / AMC — create first stage
        await tx.billingStage.create({
          data: {
            billingPlanId: billingPlan.id,
            name: 'Month 1',
            amount: money(draft.monthlyAmount),
            dueDate: draft.retainerStart ? new Date(draft.retainerStart) : null,
            status: 'PENDING',
          },
        });
      }

      return project;
    });
  },
};
