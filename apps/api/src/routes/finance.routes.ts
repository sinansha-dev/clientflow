import { Router } from 'express';
import { z } from 'zod';
import { uuidSchema } from '@clientflow/shared';
import { financeController } from '../controllers/finance.controller';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

const idParams = z.object({ id: uuidSchema });
const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).optional(),
});
const quotationSchema = z.object({
  clientId: uuidSchema,
  projectId: uuidSchema.optional().nullable().or(z.literal('')),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  validUntil: z.string().min(1),
  status: z.string().optional(),
  discount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1),
});
const invoiceSchema = z.object({
  clientId: uuidSchema,
  projectId: uuidSchema.optional().nullable().or(z.literal('')),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  status: z.string().optional(),
  currency: z.string().optional(),
  discount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1),
});
const paymentSchema = z.object({
  invoiceId: uuidSchema,
  amount: z.number().positive(),
  paymentMethod: z.string().min(1),
  referenceNumber: z.string().optional().nullable(),
  paymentDate: z.string().min(1),
  notes: z.string().optional().nullable(),
});
const expenseSchema = z.object({
  projectId: uuidSchema,
  category: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().min(1),
  receiptUrl: z.string().optional().nullable(),
  expenseDate: z.string().min(1),
});

export const quotationRoutes = Router();
quotationRoutes.use(requireAuth);
quotationRoutes.get('/', requireRole('ADMIN', 'STAFF', 'CLIENT'), (req, res, next) =>
  financeController.listQuotations(req, res).catch(next),
);
quotationRoutes.post('/', requireRole('ADMIN'), validate(quotationSchema), (req, res, next) =>
  financeController.createQuotation(req, res).catch(next),
);
quotationRoutes.patch(
  '/:id',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  validate(quotationSchema.partial()),
  (req, res, next) => financeController.updateQuotation(req, res).catch(next),
);
quotationRoutes.delete(
  '/:id',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  (req, res, next) => financeController.deleteQuotation(req, res).catch(next),
);
quotationRoutes.post(
  '/:id/send',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  (req, res, next) => financeController.sendQuotation(req, res).catch(next),
);
quotationRoutes.post(
  '/:id/approve',
  requireRole('ADMIN', 'CLIENT'),
  validate(idParams, 'params'),
  (req, res, next) => financeController.approveQuotation(req, res).catch(next),
);
quotationRoutes.post(
  '/:id/convert-project',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  (req, res, next) => financeController.convertQuotationToProject(req, res).catch(next),
);
quotationRoutes.post(
  '/:id/convert-invoice',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  (req, res, next) => financeController.convertQuotationToInvoice(req, res).catch(next),
);

export const invoiceRoutes = Router();
invoiceRoutes.use(requireAuth);
invoiceRoutes.get('/', requireRole('ADMIN', 'STAFF', 'CLIENT'), (req, res, next) =>
  financeController.listInvoices(req, res).catch(next),
);
invoiceRoutes.post('/', requireRole('ADMIN'), validate(invoiceSchema), (req, res, next) =>
  financeController.createInvoice(req, res).catch(next),
);
invoiceRoutes.patch(
  '/:id',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  validate(invoiceSchema.partial()),
  (req, res, next) => financeController.updateInvoice(req, res).catch(next),
);
invoiceRoutes.delete('/:id', requireRole('ADMIN'), validate(idParams, 'params'), (req, res, next) =>
  financeController.deleteInvoice(req, res).catch(next),
);
invoiceRoutes.post(
  '/:id/send',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  (req, res, next) => financeController.sendInvoice(req, res).catch(next),
);
invoiceRoutes.post(
  '/:id/pdf',
  requireRole('ADMIN', 'CLIENT'),
  validate(idParams, 'params'),
  (req, res, next) => financeController.invoicePdf(req, res).catch(next),
);

export const paymentRoutes = Router();
paymentRoutes.use(requireAuth);
paymentRoutes.get('/', requireRole('ADMIN', 'CLIENT'), (req, res, next) =>
  financeController.listPayments(req, res).catch(next),
);
paymentRoutes.post('/', requireRole('ADMIN'), validate(paymentSchema), (req, res, next) =>
  financeController.createPayment(req, res).catch(next),
);
paymentRoutes.patch(
  '/:id',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  validate(paymentSchema.partial()),
  (req, res, next) => financeController.updatePayment(req, res).catch(next),
);

export const expenseRoutes = Router();
expenseRoutes.use(requireAuth);
expenseRoutes.get('/', requireRole('ADMIN', 'STAFF'), (req, res, next) =>
  financeController.listExpenses(req, res).catch(next),
);
expenseRoutes.post('/', requireRole('ADMIN', 'STAFF'), validate(expenseSchema), (req, res, next) =>
  financeController.createExpense(req, res).catch(next),
);
expenseRoutes.patch(
  '/:id',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  validate(expenseSchema.partial()),
  (req, res, next) => financeController.updateExpense(req, res).catch(next),
);
expenseRoutes.delete('/:id', requireRole('ADMIN'), validate(idParams, 'params'), (req, res, next) =>
  financeController.deleteExpense(req, res).catch(next),
);

export const financeReportRoutes = Router();
financeReportRoutes.use(requireAuth, requireRole('ADMIN'));
financeReportRoutes.get('/finance', (req, res, next) =>
  financeController.report(req, res).catch(next),
);
financeReportRoutes.get('/profit', (req, res, next) =>
  financeController.report(req, res).catch(next),
);
financeReportRoutes.get('/revenue', (req, res, next) =>
  financeController.report(req, res).catch(next),
);

export const billingPlanRoutes = Router();
billingPlanRoutes.use(requireAuth);
billingPlanRoutes.get('/:projectId', requireRole('ADMIN', 'STAFF'), (req, res, next) =>
  financeController.getBillingPlan(req, res).catch(next),
);
billingPlanRoutes.post('/:projectId', requireRole('ADMIN'), (req, res, next) =>
  financeController.createOrUpdateBillingPlan(req, res).catch(next),
);
billingPlanRoutes.post(
  '/:projectId/stages/:stageId/generate-invoice',
  requireRole('ADMIN'),
  (req, res, next) => financeController.generateInvoiceForStage(req, res).catch(next),
);

export const recurringServiceRoutes = Router();
recurringServiceRoutes.use(requireAuth);
recurringServiceRoutes.get('/', requireRole('ADMIN', 'STAFF'), (req, res, next) =>
  financeController.listRecurringServices(req, res).catch(next),
);
recurringServiceRoutes.post('/', requireRole('ADMIN'), (req, res, next) =>
  financeController.createRecurringService(req, res).catch(next),
);
recurringServiceRoutes.patch('/:id/status', requireRole('ADMIN'), (req, res, next) =>
  financeController.updateRecurringServiceStatus(req, res).catch(next),
);
recurringServiceRoutes.post('/trigger-cron', requireRole('ADMIN'), (req, res, next) =>
  financeController.triggerRecurringCron(req, res).catch(next),
);
