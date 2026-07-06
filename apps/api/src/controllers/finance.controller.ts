import type { Request, Response } from 'express';
import { financeRepository } from '../repositories/finance.repository';
import { ok } from '../utils/http';
import { notFound } from '../utils/errors';

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
    const data = await financeRepository.updateQuotation(req.params.id!, req.body);
    if (!data) throw notFound('Quotation not found');
    return ok(res, 'Quotation updated successfully', data);
  },

  async deleteQuotation(req: Request, res: Response) {
    await financeRepository.deleteQuotation(req.params.id!);
    return ok(res, 'Quotation deleted successfully');
  },

  async sendQuotation(req: Request, res: Response) {
    const data = await financeRepository.setQuotationStatus(req.params.id!, 'SENT');
    return ok(res, 'Quotation marked as sent', data);
  },

  async approveQuotation(req: Request, res: Response) {
    const data = await financeRepository.setQuotationStatus(req.params.id!, 'ACCEPTED');
    return ok(res, 'Quotation approved successfully', data);
  },

  async convertQuotationToProject(_req: Request, res: Response) {
    return ok(res, 'Quotation is approved and ready to connect to a project');
  },

  async convertQuotationToInvoice(req: Request, res: Response) {
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
    const data = await financeRepository.updateInvoice(req.params.id!, req.body);
    if (!data) throw notFound('Invoice not found');
    return ok(res, 'Invoice updated successfully', data);
  },

  async deleteInvoice(req: Request, res: Response) {
    await financeRepository.deleteInvoice(req.params.id!);
    return ok(res, 'Invoice deleted successfully');
  },

  async sendInvoice(req: Request, res: Response) {
    const data = await financeRepository.setInvoiceStatus(req.params.id!, 'SENT');
    return ok(res, 'Invoice marked as sent', data);
  },

  async invoicePdf(req: Request, res: Response) {
    const invoices = await financeRepository.listInvoices(req.user!, {});
    const invoice = invoices.find((item) => item.id === req.params.id);
    if (!invoice) throw notFound('Invoice not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    return res.send(
      Buffer.from(
        `ClientFlow Invoice\n${invoice.invoiceNumber}\nTotal: ${invoice.currency} ${invoice.total}\nBalance Due: ${invoice.currency} ${invoice.balanceDue}\n`,
        'utf8',
      ),
    );
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
    const data = await financeRepository.createExpense(req.user!.id, req.body);
    return ok(res, 'Expense recorded successfully', data, 201);
  },

  async updateExpense(req: Request, res: Response) {
    const data = await financeRepository.updateExpense(req.params.id!, req.body);
    return ok(res, 'Expense updated successfully', data);
  },

  async deleteExpense(req: Request, res: Response) {
    await financeRepository.deleteExpense(req.params.id!);
    return ok(res, 'Expense deleted successfully');
  },

  async report(_req: Request, res: Response) {
    const data = await financeRepository.financeReport();
    return ok(res, 'Finance report retrieved successfully', data);
  },
};
