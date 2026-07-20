import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { financeRepository } from '../repositories/finance.repository';
import { AuthorizationService } from '../services/authorization.service';
import { ok } from '../utils/http';
import { forbidden, notFound } from '../utils/errors';
import { generateQuotationPdf, generateQuotationPdfBuffer } from '../utils/quotation-pdf';
import { generateInvoicePdf, generateInvoicePdfBuffer } from '../utils/invoice-pdf';
import { notificationService, NotificationEvents } from '../services/notification.service';
import { logger } from '../utils/logger';
import { prisma } from '../config/prisma';

export const financeController = {
  async listQuotations(req: Request, res: Response) {
    const data = await financeRepository.listQuotations(
      req.user!,
      req.query as Record<string, string>,
    );
    return ok(res, 'Quotations retrieved successfully', data);
  },

  async createQuotation(req: Request, res: Response) {
    const data = await financeRepository.createQuotation(req.user!.id, req.body);

    // Fetch client email for notification
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { email: true, companyName: true },
    });

    const recipients: string[] = [req.user!.id];
    if (client?.email) recipients.push(client.email);

    await notificationService
      .notifyEvent(
        NotificationEvents.QUOTATION_CREATED,
        recipients,
        {
          quoteNumber: data.quoteNumber,
          quoteTotal: data.total,
          validUntil: data.validUntil ? new Date(data.validUntil).toLocaleDateString() : 'N/A',
          clientName: client?.companyName || 'Client',
          actionUrl: `http://localhost:5173/finance/quotations/${data.id}`,
          actionText: 'View Quotation',
        },
        { sendEmail: true },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch Quotation Created notification'));

    return ok(res, 'Quotation created successfully', data, 201);
  },

  async updateQuotation(req: Request, res: Response) {
    const data = await financeRepository.updateQuotation(req.params.id!, req.body, req.user);
    if (!data) throw notFound('Quotation not found');
    return ok(res, 'Quotation updated successfully', data);
  },

  async deleteQuotation(req: Request, res: Response) {
    const data = await financeRepository.deleteQuotation(req.params.id!, req.user);
    if (!data) throw notFound('Quotation not found');
    return ok(res, 'Quotation deleted successfully');
  },

  async sendQuotation(req: Request, res: Response) {
    const data = await financeRepository.setQuotationStatus(req.params.id!, 'SENT', req.user);
    if (!data) throw notFound('Quotation not found');

    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { email: true, companyName: true },
    });

    const recipients: string[] = [];
    if (client?.email) recipients.push(client.email);

    // Generate in-memory PDF Buffer for attachment
    let pdfAttachment: any;
    try {
      const pdfBuffer = await generateQuotationPdfBuffer(data);
      pdfAttachment = {
        filename: `Quotation-${data.quoteNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      };
    } catch (pdfErr) {
      logger.error(
        { err: pdfErr, quoteNumber: data.quoteNumber },
        'Failed to generate in-memory quotation PDF attachment',
      );
    }

    await notificationService
      .notifyEvent(
        NotificationEvents.QUOTATION_SENT,
        recipients,
        {
          quoteNumber: data.quoteNumber,
          quoteTotal: data.total,
          validUntil: data.validUntil ? new Date(data.validUntil).toLocaleDateString() : 'N/A',
          clientName: client?.companyName || 'Client',
          actionUrl: `http://localhost:5173/finance/quotations/${data.id}`,
          actionText: 'View Quotation',
        },
        {
          sendEmail: true,
          priority: 'HIGH',
          emailOptions: {
            attachments: pdfAttachment ? [pdfAttachment] : undefined,
          },
        },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch Quotation Sent notification'));

    return ok(res, 'Quotation marked as sent', data);
  },

  async approveQuotation(req: Request, res: Response) {
    const data = await financeRepository.setQuotationStatus(req.params.id!, 'ACCEPTED', req.user);
    if (!data) throw notFound('Quotation not found');

    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { email: true, companyName: true },
    });

    const recipients: string[] = [data.createdBy];
    if (client?.email) recipients.push(client.email);

    await notificationService
      .notifyEvent(
        NotificationEvents.QUOTATION_APPROVED,
        recipients,
        {
          quoteNumber: data.quoteNumber,
          quoteTotal: data.total,
          clientName: client?.companyName || 'Client',
          actionUrl: `http://localhost:5173/finance/quotations/${data.id}`,
          actionText: 'View Approved Quotation',
        },
        { sendEmail: true, priority: 'HIGH' },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch Quotation Approved notification'));

    return ok(res, 'Quotation approved successfully', data);
  },

  async convertQuotationToProject(req: Request, res: Response) {
    await AuthorizationService.assertQuotation(req.params.id!, req.user!);
    const data = await financeRepository.convertQuotationToProject(req.params.id!, req.user!.id);
    if (!data) throw notFound('Quotation not found');
    return ok(res, 'Quotation converted to project successfully', data, 201);
  },

  async convertQuotationToInvoice(req: Request, res: Response) {
    await AuthorizationService.assertQuotation(req.params.id!, req.user!);
    const data = await financeRepository.convertQuotationToInvoice(req.params.id!, req.user!.id);
    if (!data) throw notFound('Quotation not found');
    return ok(res, 'Quotation converted to invoice', data, 201);
  },

  async listInvoices(req: Request, res: Response) {
    const data = await financeRepository.listInvoices(
      req.user!,
      req.query as Record<string, string>,
    );
    return ok(res, 'Invoices retrieved successfully', data);
  },

  async createInvoice(req: Request, res: Response) {
    const data = await financeRepository.createInvoice(req.user!.id, req.body);
    return ok(res, 'Invoice created successfully', data, 201);
  },

  async updateInvoice(req: Request, res: Response) {
    const data = await financeRepository.updateInvoice(req.params.id!, req.body, req.user);
    if (!data) throw notFound('Invoice not found');
    return ok(res, 'Invoice updated successfully', data);
  },

  async deleteInvoice(req: Request, res: Response) {
    const data = await financeRepository.deleteInvoice(req.params.id!, req.user);
    if (!data) throw notFound('Invoice not found');
    return ok(res, 'Invoice deleted successfully');
  },

  async sendInvoice(req: Request, res: Response) {
    const data = await financeRepository.setInvoiceStatus(req.params.id!, 'SENT', req.user);
    if (!data) throw notFound('Invoice not found');

    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { email: true, companyName: true },
    });

    const recipients: string[] = [];
    if (client?.email) recipients.push(client.email);

    // Generate in-memory PDF Buffer for attachment
    let pdfAttachment: any;
    try {
      const pdfBuffer = await generateInvoicePdfBuffer(data);
      pdfAttachment = {
        filename: `Invoice-${data.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      };
    } catch (pdfErr) {
      logger.error(
        { err: pdfErr, invoiceNumber: data.invoiceNumber },
        'Failed to generate in-memory invoice PDF attachment',
      );
    }

    await notificationService
      .notifyEvent(
        NotificationEvents.INVOICE_SENT,
        recipients,
        {
          invoiceNumber: data.invoiceNumber,
          invoiceTotal: data.total,
          balanceDue: data.balanceDue,
          dueDate: data.dueDate ? new Date(data.dueDate).toLocaleDateString() : 'N/A',
          clientName: client?.companyName || 'Client',
          actionUrl: `http://localhost:5173/finance/invoices/${data.id}`,
          actionText: 'View Invoice',
        },
        {
          sendEmail: true,
          priority: 'HIGH',
          emailOptions: {
            attachments: pdfAttachment ? [pdfAttachment] : undefined,
          },
        },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch Invoice Sent notification'));

    return ok(res, 'Invoice marked as sent', data);
  },

  async sendPaymentReminder(req: Request, res: Response) {
    const invoices = await financeRepository.listInvoices(req.user!, {});
    const invoice = invoices.find((item) => item.id === req.params.id);
    if (!invoice) throw notFound('Invoice not found');

    const client = await prisma.client.findUnique({
      where: { id: invoice.clientId },
      select: { email: true, companyName: true },
    });

    const recipients: string[] = [];
    if (client?.email) recipients.push(client.email);

    await notificationService
      .notifyEvent(
        NotificationEvents.PAYMENT_REMINDER,
        recipients,
        {
          invoiceNumber: invoice.invoiceNumber,
          invoiceTotal: invoice.total,
          balanceDue: invoice.balanceDue,
          dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A',
          clientName: client?.companyName || 'Client',
          actionUrl: `http://localhost:5173/finance/invoices/${invoice.id}`,
          actionText: 'Pay Invoice Now',
        },
        { sendEmail: true, priority: 'HIGH' },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch Payment Reminder notification'));

    return ok(res, 'Payment reminder dispatched successfully');
  },

  async reviseInvoice(req: Request, res: Response) {
    const data = await financeRepository.reviseInvoice(req.params.id!, req.user!.id);
    if (!data) throw notFound('Invoice not found');
    return ok(res, 'Invoice revision draft created', data);
  },

  async voidInvoice(req: Request, res: Response) {
    const data = await financeRepository.voidInvoice(req.params.id!, req.user!.id);
    if (!data) throw notFound('Invoice not found');
    return ok(res, 'Invoice voided successfully', data);
  },

  async invoicePdf(req: Request, res: Response) {
    const invoices = await financeRepository.listInvoices(req.user!, {});
    const invoice = invoices.find((item) => item.id === req.params.id) as any;
    if (!invoice) throw notFound('Invoice not found');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);

    await generateInvoicePdf(invoice, res);
  },

  async quotationPdf(req: Request, res: Response) {
    const quotations = await financeRepository.listQuotations(req.user!, {});
    const q = quotations.find((item) => item.id === req.params.id) as any;
    if (!q) throw notFound('Quotation not found');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${q.quoteNumber}.pdf"`);

    await generateQuotationPdf(q, res);
  },

  async listPayments(req: Request, res: Response) {
    const data = await financeRepository.listPayments(
      req.user!,
      req.query as Record<string, string>,
    );
    return ok(res, 'Payments retrieved successfully', data);
  },

  async createPayment(req: Request, res: Response) {
    const data = await financeRepository.createPayment(req.user!.id, req.body);
    if (!data) throw notFound('Invoice not found');

    // Fetch related invoice and client details
    const invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { client: true },
    });

    const recipients: string[] = [req.user!.id];
    if (invoice?.client?.email) recipients.push(invoice.client.email);

    // Dispatch Payment Received Notification
    await notificationService
      .notifyEvent(
        NotificationEvents.PAYMENT_RECEIVED,
        recipients,
        {
          invoiceNumber: invoice?.invoiceNumber || '',
          amountPaid: data.amount,
          balanceDue: invoice?.balanceDue || 0,
          clientName: invoice?.client?.companyName || 'Client',
          actionUrl: `http://localhost:5173/finance/invoices/${invoice?.id}`,
          actionText: 'View Payment Receipt',
        },
        { sendEmail: true, priority: 'HIGH' },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch Payment Received notification'));

    // If invoice is fully paid, dispatch Invoice Paid Notification
    if (invoice && (invoice.balanceDue <= 0 || invoice.status === 'PAID')) {
      await notificationService
        .notifyEvent(
          NotificationEvents.INVOICE_PAID,
          recipients,
          {
            invoiceNumber: invoice.invoiceNumber,
            invoiceTotal: invoice.total,
            amountPaid: invoice.amountPaid,
            balanceDue: 0,
            clientName: invoice.client.companyName,
            actionUrl: `http://localhost:5173/finance/invoices/${invoice.id}`,
            actionText: 'View Paid Invoice',
          },
          { sendEmail: true, priority: 'HIGH' },
        )
        .catch((err) => logger.error({ err }, 'Failed to dispatch Invoice Paid notification'));
    }

    return ok(res, 'Payment recorded successfully', data, 201);
  },

  async updatePayment(req: Request, res: Response) {
    await AuthorizationService.assertPayment(req.params.id!, req.user!);
    const data = await financeRepository.updatePayment(req.params.id!, req.body);
    return ok(res, 'Payment updated successfully', data);
  },

  async listExpenses(req: Request, res: Response) {
    const data = await financeRepository.listExpenses(
      req.user!,
      req.query as Record<string, string>,
    );
    return ok(res, 'Expenses retrieved successfully', data);
  },

  async createExpense(req: Request, res: Response) {
    const data = await financeRepository.createExpense(req.user!.id, req.body, req.user);
    return ok(res, 'Expense recorded successfully', data, 201);
  },

  async updateExpense(req: Request, res: Response) {
    const data = await financeRepository.updateExpense(req.params.id!, req.body, req.user);
    if (!data) throw notFound('Expense not found');
    return ok(res, 'Expense updated successfully', data);
  },

  async deleteExpense(req: Request, res: Response) {
    const data = await financeRepository.deleteExpense(req.params.id!, req.user);
    if (!data) throw notFound('Expense not found');
    return ok(res, 'Expense deleted successfully');
  },

  async report(_req: Request, res: Response) {
    const data = await financeRepository.financeReport();
    return ok(res, 'Finance report retrieved successfully', data);
  },

  // --- Billing Plans & Stages ---
  async getBillingPlan(req: Request, res: Response) {
    await AuthorizationService.assertProject(req.params.projectId!, req.user!);
    const data = await financeRepository.getBillingPlan(req.params.projectId!);
    return ok(res, 'Billing plan retrieved successfully', data);
  },

  async createOrUpdateBillingPlan(req: Request, res: Response) {
    await AuthorizationService.assertProject(req.params.projectId!, req.user!);
    const data = await financeRepository.createOrUpdateBillingPlan(req.params.projectId!, req.body);
    return ok(res, 'Billing plan updated successfully', data);
  },

  async generateInvoiceForStage(req: Request, res: Response) {
    await AuthorizationService.assertProject(req.params.projectId!, req.user!);
    const data = await financeRepository.generateInvoiceForStage(
      req.params.projectId!,
      req.params.stageId!,
      req.user!.id,
    );
    return ok(res, 'Invoice generated successfully', data, 201);
  },

  // --- Recurring Services ---
  async listRecurringServices(_req: Request, res: Response) {
    const data = await financeRepository.listRecurringServices();
    return ok(res, 'Recurring services retrieved successfully', data);
  },

  async createRecurringService(req: Request, res: Response) {
    await AuthorizationService.assertProject(req.body.projectId, req.user!);
    const data = await financeRepository.createRecurringService(req.body.projectId, req.body);
    return ok(res, 'Recurring service created successfully', data, 201);
  },

  async updateRecurringServiceStatus(req: Request, res: Response) {
    const data = await financeRepository.updateRecurringServiceStatus(
      req.params.id!,
      req.body.status,
    );
    return ok(res, 'Recurring service status updated successfully', data);
  },

  async triggerRecurringCron(req: Request, res: Response) {
    const data = await financeRepository.triggerRecurringCron(req.user!.id);
    return ok(res, 'Recurring services cron triggered successfully', data);
  },
};
