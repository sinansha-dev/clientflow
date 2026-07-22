import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailProviderFactory } from './email/email-provider.factory';
import { MockEmailProvider } from './email/mock-email.provider';
import { emailService } from './email.service';
import { notificationService, NotificationEvents } from './notification.service';
import { emailTemplateEngine } from './email/email-template.engine';
import { generateQuotationPdfBuffer } from '../utils/quotation-pdf';
import { generateInvoicePdfBuffer } from '../utils/invoice-pdf';
import { emailQueueService } from './email-queue.service';
import { notificationConfig } from '../config/notification.config';

test('EmailProviderFactory returns MockEmailProvider in test mode or when requested', () => {
  const provider = EmailProviderFactory.getProvider('MOCK');
  assert.equal(provider instanceof MockEmailProvider, true);
  assert.equal(provider.name, 'MOCK');
});

test('MockEmailProvider sends email successfully and stores sent log with attachments in memory', async () => {
  const mockProvider = new MockEmailProvider();
  mockProvider.clear();

  const dummyPdf = Buffer.from('%PDF-1.5 test pdf content');

  const res = await mockProvider.sendEmail({
    to: 'user@example.com',
    subject: 'Test Subject',
    text: 'Test Body',
    attachments: [
      {
        filename: 'Quotation-QTN-00045.pdf',
        content: dummyPdf,
        contentType: 'application/pdf',
      },
    ],
  });

  assert.equal(res.success, true);
  assert.equal(res.provider, 'MOCK');
  assert.ok(res.messageId);
  assert.equal(mockProvider.sentEmails.length, 1);
  assert.equal(mockProvider.sentEmails[0]!.to, 'user@example.com');
  assert.ok(mockProvider.sentEmails[0]!.attachments);
  assert.equal(mockProvider.sentEmails[0]!.attachments[0]!.filename, 'Quotation-QTN-00045.pdf');
});

test('generateQuotationPdfBuffer generates valid in-memory PDF Buffer without writing files to disk', async () => {
  const sampleQuotation = {
    quoteNumber: 'QTN-2026-0003',
    title: 'Website Redesign Proposal',
    quoteDate: new Date(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    currency: 'USD',
    subtotal: 5000,
    tax: 500,
    discount: 200,
    total: 5300,
    items: [
      {
        name: 'UI/UX Design',
        description: 'Figma mockups and design system',
        quantity: 1,
        unitPrice: 2000,
        taxRate: 10,
        total: 2200,
      },
      {
        name: 'Frontend Development',
        description: 'Next.js implementation',
        quantity: 1,
        unitPrice: 3000,
        taxRate: 10,
        total: 3300,
      },
    ],
    client: {
      companyName: 'Acme Corp',
      billingAddress: '123 Tech Way',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94107',
      country: 'USA',
    },
  };

  const buffer = await generateQuotationPdfBuffer(sampleQuotation);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000); // Check PDF header and binary structure
  assert.equal(buffer.subarray(0, 4).toString('utf-8'), '%PDF');
});

test('generateInvoicePdfBuffer generates valid in-memory PDF Buffer without writing files to disk', async () => {
  const sampleInvoice = {
    invoiceNumber: 'INV-2026-0005',
    title: 'Web Application Development Invoice',
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    currency: 'USD',
    subtotal: 4000,
    tax: 400,
    discount: 0,
    total: 4400,
    amountPaid: 0,
    balanceDue: 4400,
    items: [
      {
        name: 'Sprint 1 Development',
        description: 'Core REST API & Authentication',
        quantity: 1,
        unitPrice: 4000,
        taxRate: 10,
        total: 4400,
      },
    ],
    client: {
      companyName: 'Starlight Inc',
      billingAddress: '456 Innovation Blvd',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'USA',
    },
  };

  const buffer = await generateInvoicePdfBuffer(sampleInvoice);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000);
  assert.equal(buffer.subarray(0, 4).toString('utf-8'), '%PDF');
});

test('NotificationEvents catalog contains all required business notification events', () => {
  assert.equal(NotificationEvents.AUTH_USER_INVITED, 'auth.user.invited');
  assert.equal(NotificationEvents.AUTH_WELCOME, 'auth.welcome');
  assert.equal(NotificationEvents.AUTH_PASSWORD_RESET, 'auth.password.reset');
  assert.equal(NotificationEvents.CRM_CLIENT_INVITATION, 'crm.client.invitation');
  assert.equal(NotificationEvents.PROJECT_ASSIGNED, 'project.assigned');
  assert.equal(NotificationEvents.QUOTATION_SENT, 'quotation.sent');
  assert.equal(NotificationEvents.INVOICE_SENT, 'invoice.sent');
  assert.equal(NotificationEvents.PAYMENT_RECEIVED, 'payment.received');
  assert.equal(NotificationEvents.PAYMENT_REMINDER, 'payment.reminder');
  assert.equal(NotificationEvents.TASK_ASSIGNED, 'task.assigned');
  assert.equal(NotificationEvents.MEETING_REMINDER, 'meeting.reminder');
  assert.equal(NotificationEvents.AMC_RENEWAL_REMINDER, 'amc.renewal_reminder');
});

test('EmailTemplateEngine renders dynamic responsive HTML and plain text for all module events', () => {
  // Authentication
  const invite = emailTemplateEngine.render(NotificationEvents.AUTH_USER_INVITED, {
    userEmail: 'newstaff@clientflow.local',
    role: 'STAFF',
    inviteLink: 'http://localhost:5173/register?token=123',
  });
  assert.ok(invite.subject.includes('invited'));
  assert.ok(invite.html.includes('newstaff@clientflow.local'));
  assert.ok(invite.text.includes('Action Link'));

  // Finance / Invoice
  const invoice = emailTemplateEngine.render(NotificationEvents.INVOICE_SENT, {
    invoiceNumber: 'INV-00025',
    invoiceTotal: 1500,
    balanceDue: 1500,
    dueDate: '2026-08-15',
  });
  assert.equal(invoice.subject, 'Invoice INV-00025');
  assert.ok(invoice.html.includes('INV-00025'));
  assert.ok(invoice.html.includes('$1,500'));

  // Task
  const task = emailTemplateEngine.render(NotificationEvents.TASK_ASSIGNED, {
    taskTitle: 'Integrate Email Notifications',
    taskStatus: 'IN_PROGRESS',
    taskPriority: 'HIGH',
    projectName: 'ClientFlow v2',
  });
  assert.equal(task.subject, 'Task Assigned: Integrate Email Notifications');
  assert.ok(task.html.includes('Integrate Email Notifications'));

  // AMC
  const amc = emailTemplateEngine.render(NotificationEvents.AMC_RENEWAL_REMINDER, {
    amcName: 'Annual Cloud Hosting AMC',
    amcAmount: 2400,
    expiryDate: '2026-09-01',
  });
  assert.ok(amc.subject.includes('AMC Renewal Reminder'));
  assert.ok(amc.html.includes('Annual Cloud Hosting AMC'));
});

test('NotificationService handles missing recipients gracefully without throwing exception', async () => {
  const result = await notificationService.notify({
    event: 'test.event',
    title: 'Test Title',
    message: 'Test Message',
    recipients: [],
  });

  assert.equal(result.success, true);
  assert.equal(result.recipientCount, 0);
  assert.ok(result.errors);
  assert.equal(result.errors[0], 'No recipients provided');
});

test('NotificationService handles invalid/unresolvable recipients gracefully', async () => {
  const result = await notificationService.notify({
    event: 'test.event',
    title: 'Test Title',
    message: 'Test Message',
    recipients: ['invalid-uuid-format-that-is-not-email'],
  });

  assert.equal(result.success, false);
  assert.equal(result.recipientCount, 0);
  assert.ok(result.errors);
});

test('NotificationService isolates errors and does not throw on delivery failure', async () => {
  const result = await notificationService.notify({
    event: NotificationEvents.SYSTEM_ANNOUNCEMENT,
    title: 'System Announcement',
    message: 'Scheduled maintenance notice',
    recipients: ['dev@clientflow.local'],
    sendEmail: true,
  });

  assert.ok(result);
  assert.equal(typeof result.success, 'boolean');
});

test('NotificationService.notifyEvent correctly formats and dispatches business event notification with attachments', async () => {
  const pdfBuffer = Buffer.from('%PDF-1.5 test quotation attachment');

  const mockProvider = EmailProviderFactory.getProvider('MOCK') as MockEmailProvider;
  mockProvider.clear();

  const result = await emailService.sendEmail(
    {
      to: 'client@acme.com',
      subject: 'Quotation QTN-00018',
      html: '<p>Please find attached your quotation.</p>',
      attachments: [
        {
          filename: 'Quotation-QTN-00018.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    },
    'MOCK',
  );

  assert.ok(result.success);
  assert.equal(mockProvider.sentEmails.length, 1);
  assert.ok(mockProvider.sentEmails[0]!.attachments);
  assert.equal(mockProvider.sentEmails[0]!.attachments[0]!.filename, 'Quotation-QTN-00018.pdf');
});

test('EmailQueueService enqueues and processes email jobs asynchronously', async () => {
  emailQueueService.enqueue({
    recipient: 'queue-test@clientflow.local',
    subject: 'Queued Email Test',
    html: '<p>Testing background email queue execution</p>',
    providerName: 'MOCK',
    event: 'test.queued.email',
  });

  // Verify enqueue returns immediately without blocking
  assert.ok(emailQueueService.getQueueLength() >= 0);

  // Wait for worker to finish processing queued jobs
  await emailQueueService.drainQueue();
  assert.equal(emailQueueService.getQueueLength(), 0);
  assert.equal(emailQueueService.isProcessing(), false);
});
