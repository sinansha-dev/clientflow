import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { financeRepository } from '../repositories/finance.repository';
import { AuthorizationService } from '../services/authorization.service';
import { ok } from '../utils/http';
import { forbidden, notFound } from '../utils/errors';
import { generateQuotationPdf } from '../utils/quotation-pdf';
import { generateInvoicePdf } from '../utils/invoice-pdf';

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
    return ok(res, 'Quotation marked as sent', data);
  },

  async approveQuotation(req: Request, res: Response) {
    const data = await financeRepository.setQuotationStatus(req.params.id!, 'ACCEPTED', req.user);
    if (!data) throw notFound('Quotation not found');
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
    return ok(res, 'Invoice marked as sent', data);
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
