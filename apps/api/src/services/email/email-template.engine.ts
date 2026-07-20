import { notificationConfig } from '../../config/notification.config';

export interface EmailTemplateData {
  recipientName?: string | undefined;
  userEmail?: string | undefined;
  companyName?: string | undefined;
  clientName?: string | undefined;
  projectName?: string | undefined;
  projectCode?: string | undefined;
  taskTitle?: string | undefined;
  taskStatus?: string | undefined;
  taskPriority?: string | undefined;
  quoteNumber?: string | undefined;
  quoteTotal?: number | undefined;
  validUntil?: string | undefined;
  invoiceNumber?: string | undefined;
  invoiceTotal?: number | undefined;
  amountPaid?: number | undefined;
  balanceDue?: number | undefined;
  dueDate?: string | undefined;
  meetingTitle?: string | undefined;
  meetingDate?: string | undefined;
  meetingLink?: string | undefined;
  amcName?: string | undefined;
  amcAmount?: number | undefined;
  expiryDate?: string | undefined;
  resetLink?: string | undefined;
  inviteLink?: string | undefined;
  actionUrl?: string | undefined;
  actionText?: string | undefined;
  details?: Record<string, any> | undefined;
  customMessage?: string | undefined;
  [key: string]: any;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const emailTemplateEngine = {
  render(event: string, data: EmailTemplateData = {}): RenderedEmail {
    const companyName = notificationConfig.smtp.fromName || 'ClientFlow';
    const recipientName = data.recipientName || 'Valued User';

    const subject = this.generateSubject(event, data);
    const bodyContent = this.generateBodyContent(event, data);
    const plainTextBody = this.generatePlainText(event, data);
    const ctaButton = this.generateCtaButton(data);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(subject)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f5f7;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      color: #1f2937;
    }
    .wrapper {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
      border: 1px solid #e5e7eb;
    }
    .header {
      background-color: #4f46e5;
      background-image: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      padding: 28px 32px;
      color: #ffffff;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 32px;
    }
    .greeting {
      font-size: 17px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
    }
    .message {
      font-size: 15px;
      line-height: 1.6;
      color: #4b5563;
      margin-bottom: 24px;
    }
    .details-box {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
    }
    .details-table td {
      padding: 8px 0;
      font-size: 14px;
      border-bottom: 1px dashed #e5e7eb;
    }
    .details-table tr:last-child td {
      border-bottom: none;
    }
    .details-label {
      color: #6b7280;
      font-weight: 500;
      width: 40%;
    }
    .details-value {
      color: #111827;
      font-weight: 600;
      width: 60%;
      text-align: right;
    }
    .cta-container {
      text-align: center;
      margin: 28px 0;
    }
    .cta-button {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      font-size: 15px;
      font-weight: 600;
      padding: 12px 28px;
      border-radius: 8px;
      text-decoration: none;
      box-shadow: 0 2px 5px rgba(79, 70, 229, 0.3);
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px 32px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 13px;
      color: #6b7280;
    }
    .footer a {
      color: #4f46e5;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${this.escapeHtml(companyName)}</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello ${this.escapeHtml(recipientName)},</div>
      ${bodyContent}
      ${ctaButton}
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px 0;">© ${new Date().getFullYear()} ${this.escapeHtml(companyName)}. All rights reserved.</p>
      <p style="margin: 0;">This email notification was sent automatically from your ClientFlow workspace.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return { subject, html, text: plainTextBody };
  },

  generateSubject(event: string, data: EmailTemplateData): string {
    switch (event) {
      // Authentication
      case 'auth.user.invited':
        return `You've been invited to ${notificationConfig.smtp.fromName || 'ClientFlow'}`;
      case 'auth.welcome':
        return `Welcome to ${notificationConfig.smtp.fromName || 'ClientFlow'}!`;
      case 'auth.password.reset':
        return `Reset your ${notificationConfig.smtp.fromName || 'ClientFlow'} password`;
      case 'auth.password.changed':
        return `Your ${notificationConfig.smtp.fromName || 'ClientFlow'} password was updated`;
      case 'auth.email.changed':
        return 'Email address changed successfully';
      case 'auth.account.activated':
        return 'Your account has been activated';
      case 'auth.account.locked':
        return 'Account Status Security Update';

      // CRM
      case 'crm.lead.assigned':
        return `New Lead Assigned: ${data.clientName || 'Client'}`;
      case 'crm.lead.converted':
        return `Lead Converted: ${data.clientName || 'Client'}`;
      case 'crm.client.invitation':
        return `Client Portal Invitation - ${notificationConfig.smtp.fromName || 'ClientFlow'}`;
      case 'crm.client.status_updated':
        return `Client Status Updated: ${data.clientName || 'Client'}`;

      // Projects
      case 'project.created':
        return `New Project Created: ${data.projectName || 'Project'}`;
      case 'project.assigned':
        return `Assigned to Project: ${data.projectName || 'Project'}`;
      case 'project.completed':
        return `Project Completed: ${data.projectName || 'Project'}`;
      case 'project.cancelled':
        return `Project Cancelled: ${data.projectName || 'Project'}`;

      // Quotations
      case 'quotation.created':
        return `New Quotation ${data.quoteNumber || ''}`;
      case 'quotation.sent':
        return `Quotation ${data.quoteNumber || ''}`;
      case 'quotation.approved':
        return `Quotation Approved: ${data.quoteNumber || ''}`;
      case 'quotation.rejected':
        return `Quotation Rejected: ${data.quoteNumber || ''}`;
      case 'quotation.expiring_soon':
        return `Quotation Expiring Soon: ${data.quoteNumber || ''}`;

      // Finance
      case 'invoice.sent':
        return `Invoice ${data.invoiceNumber || ''}`;
      case 'invoice.overdue':
        return `Overdue Invoice Notice: ${data.invoiceNumber || ''}`;
      case 'invoice.paid':
        return `Invoice Paid: ${data.invoiceNumber || ''}`;
      case 'payment.reminder':
        return `Payment Reminder for Invoice ${data.invoiceNumber || ''}`;
      case 'payment.received':
        return `Payment received for Invoice ${data.invoiceNumber || ''}`;

      // Tasks
      case 'task.assigned':
        return `Task Assigned: ${data.taskTitle || 'Task'}`;
      case 'task.updated':
        return `Task Updated: ${data.taskTitle || 'Task'}`;
      case 'task.completed':
        return `Task Completed: ${data.taskTitle || 'Task'}`;
      case 'task.due_tomorrow':
        return `Task Due Tomorrow: ${data.taskTitle || 'Task'}`;
      case 'task.overdue':
        return `Task Overdue: ${data.taskTitle || 'Task'}`;

      // Meetings
      case 'meeting.scheduled':
        return `Meeting Scheduled: ${data.meetingTitle || 'Meeting'}`;
      case 'meeting.reminder':
        return `Meeting Reminder: ${data.meetingTitle || 'Meeting'}`;
      case 'meeting.cancelled':
        return `Meeting Cancelled: ${data.meetingTitle || 'Meeting'}`;

      // AMC
      case 'amc.expiring':
        return `AMC Expiring Soon: ${data.amcName || 'Service'}`;
      case 'amc.renewal_reminder':
        return `AMC Renewal Reminder: ${data.amcName || 'Service'}`;

      default:
        return data.subject || 'ClientFlow Notification';
    }
  },

  generateBodyContent(event: string, data: EmailTemplateData): string {
    const customMsg = data.customMessage
      ? `<p class="message">${this.escapeHtml(data.customMessage)}</p>`
      : '';

    switch (event) {
      // Authentication
      case 'auth.user.invited':
        return `
          <p class="message">You have been invited to join <strong>${this.escapeHtml(notificationConfig.smtp.fromName || 'ClientFlow')}</strong>.</p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Role</td><td class="details-value">${this.escapeHtml(data.role || 'Team Member')}</td></tr>
              <tr><td class="details-label">Email</td><td class="details-value">${this.escapeHtml(data.userEmail || '')}</td></tr>
            </table>
          </div>
          <p class="message">Click the button below to accept your invitation and set up your account password.</p>
        `;

      case 'auth.welcome':
        return `
          <p class="message">Welcome to <strong>${this.escapeHtml(notificationConfig.smtp.fromName || 'ClientFlow')}</strong>! Your account has been successfully set up and activated.</p>
          <p class="message">You can now access your dashboard, collaborate with team members, and track client operations smoothly.</p>
        `;

      case 'auth.password.reset':
        return `
          <p class="message">We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
          <p class="message">To set a new password, click the reset button below. This link will expire shortly for security.</p>
        `;

      case 'auth.password.changed':
        return `
          <p class="message">This is confirmation that the password for your account (<strong>${this.escapeHtml(data.userEmail || '')}</strong>) was recently changed.</p>
          <p class="message">If you did not perform this change, please contact your workspace administrator immediately.</p>
        `;

      case 'auth.email.changed':
        return `
          <p class="message">Your ClientFlow account email address has been updated to <strong>${this.escapeHtml(data.userEmail || '')}</strong>.</p>
        `;

      case 'auth.account.activated':
        return `
          <p class="message">Great news! Your account status has been updated to <strong>ACTIVE</strong>. You now have full access to your assigned tools and projects.</p>
        `;

      case 'auth.account.locked':
        return `
          <p class="message">Your account status has been set to <strong>SUSPENDED</strong>. Access to the platform is currently restricted.</p>
          <p class="message">If you believe this is an error, please reach out to your administrator.</p>
        `;

      // CRM
      case 'crm.lead.assigned':
        return `
          <p class="message">A new lead has been assigned to you for management.</p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Company Name</td><td class="details-value">${this.escapeHtml(data.clientName || 'N/A')}</td></tr>
              <tr><td class="details-label">Industry</td><td class="details-value">${this.escapeHtml(data.industry || 'N/A')}</td></tr>
            </table>
          </div>
        `;

      case 'crm.lead.converted':
        return `
          <p class="message">Lead <strong>${this.escapeHtml(data.clientName || '')}</strong> has been successfully converted to an active Client!</p>
        `;

      case 'crm.client.invitation':
        return `
          <p class="message">You have been invited to access the Client Portal for <strong>${this.escapeHtml(data.companyName || 'our services')}</strong>.</p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Portal User</td><td class="details-value">${this.escapeHtml(data.userEmail || '')}</td></tr>
            </table>
          </div>
          <p class="message">Use the link below to access project updates, invoices, and shared deliverables.</p>
        `;

      case 'crm.client.status_updated':
        return `
          <p class="message">The status for client <strong>${this.escapeHtml(data.clientName || '')}</strong> has been updated to <strong>${this.escapeHtml(data.status || '')}</strong>.</p>
        `;

      // Projects
      case 'project.created':
        return `
          <p class="message">A new project has been created.</p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Project Name</td><td class="details-value">${this.escapeHtml(data.projectName || '')}</td></tr>
              <tr><td class="details-label">Project Code</td><td class="details-value">${this.escapeHtml(data.projectCode || '')}</td></tr>
              <tr><td class="details-label">Client</td><td class="details-value">${this.escapeHtml(data.clientName || 'N/A')}</td></tr>
            </table>
          </div>
        `;

      case 'project.assigned':
        return `
          <p class="message">You have been assigned to project <strong>${this.escapeHtml(data.projectName || '')}</strong>.</p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Project Code</td><td class="details-value">${this.escapeHtml(data.projectCode || '')}</td></tr>
              <tr><td class="details-label">Assigned Role</td><td class="details-value">${this.escapeHtml(data.projectRole || 'Team Member')}</td></tr>
            </table>
          </div>
        `;

      case 'project.completed':
        return `
          <p class="message">Project <strong>${this.escapeHtml(data.projectName || '')}</strong> (${this.escapeHtml(data.projectCode || '')}) has been marked as <strong>COMPLETED</strong>!</p>
          <p class="message">Thank you for your hard work and collaboration.</p>
        `;

      case 'project.cancelled':
        return `
          <p class="message">Project <strong>${this.escapeHtml(data.projectName || '')}</strong> has been cancelled.</p>
        `;

      // Quotations
      case 'quotation.created':
      case 'quotation.sent':
        return `
          <p class="message">Please find details for Quotation <strong>${this.escapeHtml(data.quoteNumber || '')}</strong> below.</p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Quote Number</td><td class="details-value">${this.escapeHtml(data.quoteNumber || '')}</td></tr>
              <tr><td class="details-label">Total Amount</td><td class="details-value">$${(data.quoteTotal || 0).toLocaleString()}</td></tr>
              <tr><td class="details-label">Valid Until</td><td class="details-value">${this.escapeHtml(data.validUntil || 'N/A')}</td></tr>
            </table>
          </div>
          ${customMsg}
        `;

      case 'quotation.approved':
        return `
          <p class="message">Quotation <strong>${this.escapeHtml(data.quoteNumber || '')}</strong> has been <strong>APPROVED</strong>!</p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Total Amount</td><td class="details-value">$${(data.quoteTotal || 0).toLocaleString()}</td></tr>
            </table>
          </div>
        `;

      case 'quotation.rejected':
        return `
          <p class="message">Quotation <strong>${this.escapeHtml(data.quoteNumber || '')}</strong> has been declined.</p>
        `;

      case 'quotation.expiring_soon':
        return `
          <p class="message">Reminder: Quotation <strong>${this.escapeHtml(data.quoteNumber || '')}</strong> is scheduled to expire on <strong>${this.escapeHtml(data.validUntil || '')}</strong>.</p>
        `;

      // Finance
      case 'invoice.sent':
      case 'payment.reminder':
      case 'invoice.overdue':
        const isOverdue = event === 'invoice.overdue';
        return `
          <p class="message">${isOverdue ? 'URGENT: Your invoice is overdue for payment.' : 'Please find details for your invoice below.'}</p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Invoice Number</td><td class="details-value">${this.escapeHtml(data.invoiceNumber || '')}</td></tr>
              <tr><td class="details-label">Total Amount</td><td class="details-value">$${(data.invoiceTotal || 0).toLocaleString()}</td></tr>
              <tr><td class="details-label">Balance Due</td><td class="details-value" style="color: #dc2626;">$${(data.balanceDue ?? data.invoiceTotal ?? 0).toLocaleString()}</td></tr>
              <tr><td class="details-label">Due Date</td><td class="details-value">${this.escapeHtml(data.dueDate || 'N/A')}</td></tr>
            </table>
          </div>
          ${customMsg}
        `;

      case 'invoice.paid':
      case 'payment.received':
        return `
          <p class="message">Payment has been successfully received and recorded.</p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Invoice Number</td><td class="details-value">${this.escapeHtml(data.invoiceNumber || '')}</td></tr>
              <tr><td class="details-label">Amount Paid</td><td class="details-value" style="color: #16a34a;">$${(data.amountPaid || data.invoiceTotal || 0).toLocaleString()}</td></tr>
              <tr><td class="details-label">Remaining Balance</td><td class="details-value">$${(data.balanceDue ?? 0).toLocaleString()}</td></tr>
            </table>
          </div>
          <p class="message">Thank you for your prompt payment!</p>
        `;

      // Tasks
      case 'task.assigned':
      case 'task.updated':
      case 'task.completed':
      case 'task.due_tomorrow':
      case 'task.overdue':
        return `
          <p class="message">Task notification update for: <strong>${this.escapeHtml(data.taskTitle || '')}</strong></p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Task Title</td><td class="details-value">${this.escapeHtml(data.taskTitle || '')}</td></tr>
              <tr><td class="details-label">Status</td><td class="details-value">${this.escapeHtml(data.taskStatus || 'N/A')}</td></tr>
              <tr><td class="details-label">Priority</td><td class="details-value">${this.escapeHtml(data.taskPriority || 'NORMAL')}</td></tr>
              <tr><td class="details-label">Project</td><td class="details-value">${this.escapeHtml(data.projectName || 'N/A')}</td></tr>
              ${data.dueDate ? `<tr><td class="details-label">Due Date</td><td class="details-value">${this.escapeHtml(data.dueDate)}</td></tr>` : ''}
            </table>
          </div>
          ${customMsg}
        `;

      // Meetings
      case 'meeting.scheduled':
      case 'meeting.reminder':
        return `
          <p class="message">${event === 'meeting.reminder' ? 'Reminder: You have an upcoming meeting.' : 'A new meeting has been scheduled.'}</p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Meeting Title</td><td class="details-value">${this.escapeHtml(data.meetingTitle || '')}</td></tr>
              <tr><td class="details-label">Date & Time</td><td class="details-value">${this.escapeHtml(data.meetingDate || '')}</td></tr>
              ${data.meetingLink ? `<tr><td class="details-label">Join Link</td><td class="details-value"><a href="${this.escapeHtml(data.meetingLink)}">Join Meeting</a></td></tr>` : ''}
            </table>
          </div>
        `;

      case 'meeting.cancelled':
        return `
          <p class="message">Meeting <strong>${this.escapeHtml(data.meetingTitle || '')}</strong> scheduled for ${this.escapeHtml(data.meetingDate || '')} has been cancelled.</p>
        `;

      // AMC
      case 'amc.expiring':
      case 'amc.renewal_reminder':
        return `
          <p class="message">Notice: AMC Service Contract <strong>${this.escapeHtml(data.amcName || '')}</strong> is due for renewal.</p>
          <div class="details-box">
            <table class="details-table">
              <tr><td class="details-label">Contract Name</td><td class="details-value">${this.escapeHtml(data.amcName || '')}</td></tr>
              <tr><td class="details-label">Amount</td><td class="details-value">$${(data.amcAmount || 0).toLocaleString()}</td></tr>
              <tr><td class="details-label">Expiration Date</td><td class="details-value">${this.escapeHtml(data.expiryDate || 'N/A')}</td></tr>
            </table>
          </div>
        `;

      default:
        return (
          customMsg ||
          `<p class="message">You have a new notification regarding ${this.escapeHtml(event)}.</p>`
        );
    }
  },

  generateCtaButton(data: EmailTemplateData): string {
    const url = data.actionUrl || data.resetLink || data.inviteLink || data.meetingLink;
    let text = data.actionText;

    if (!text) {
      if (data.resetLink) text = 'Reset Password';
      else if (data.inviteLink) text = 'Accept Invitation';
      else if (data.meetingLink) text = 'Join Meeting';
      else if (data.invoiceNumber) text = 'View Invoice';
      else if (data.quoteNumber) text = 'View Quotation';
      else if (data.taskTitle) text = 'View Task';
      else if (data.projectName) text = 'View Project';
      else if (data.actionUrl) text = 'View Details';
    }

    if (!url || !text) return '';

    return `
      <div class="cta-container">
        <a href="${this.escapeHtml(url)}" class="cta-button" target="_blank">${this.escapeHtml(text)}</a>
      </div>
    `;
  },

  generatePlainText(event: string, data: EmailTemplateData): string {
    const company = notificationConfig.smtp.fromName || 'ClientFlow';
    const subject = this.generateSubject(event, data);

    let text = `${company} - ${subject}\n\nHello ${data.recipientName || 'User'},\n\n`;

    if (data.customMessage) {
      text += `${data.customMessage}\n\n`;
    }

    if (data.invoiceNumber) {
      text += `Invoice Number: ${data.invoiceNumber}\nTotal: $${data.invoiceTotal || 0}\nDue Date: ${data.dueDate || 'N/A'}\n\n`;
    } else if (data.quoteNumber) {
      text += `Quotation Number: ${data.quoteNumber}\nTotal: $${data.quoteTotal || 0}\nValid Until: ${data.validUntil || 'N/A'}\n\n`;
    } else if (data.projectName) {
      text += `Project: ${data.projectName} (${data.projectCode || ''})\n\n`;
    } else if (data.taskTitle) {
      text += `Task: ${data.taskTitle}\nStatus: ${data.taskStatus || 'N/A'}\nPriority: ${data.taskPriority || 'NORMAL'}\n\n`;
    } else if (data.meetingTitle) {
      text += `Meeting: ${data.meetingTitle}\nDate: ${data.meetingDate || 'N/A'}\nLink: ${data.meetingLink || 'N/A'}\n\n`;
    }

    const actionUrl = data.actionUrl || data.resetLink || data.inviteLink || data.meetingLink;
    if (actionUrl) {
      text += `Action Link: ${actionUrl}\n\n`;
    }

    text += `Thank you,\n${company} Team`;
    return text;
  },

  escapeHtml(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};
