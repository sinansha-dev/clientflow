export type Role = 'ADMIN' | 'STAFF' | 'CLIENT';
export type ProjectRole =
  'PROJECT_MANAGER' | 'LEAD_DEVELOPER' | 'DEVELOPER' | 'DESIGNER' | 'QA' | 'VIEWER';
export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
  phone?: string | null;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  hourlyRate?: number | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T | undefined;
  errors?: Array<{ path: string; message: string }> | undefined;
}

export interface Client {
  id: string;
  companyName: string;
  companyLogo?: string | null;
  industry: string;
  website: string;
  email: string;
  phone: string;
  taxNumber?: string | null;
  billingAddress: string;
  shippingAddress: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  currency: string;
  timezone: string;
  status: string;
  source?: string | null;
  assignedManagerId?: string | null;
  assignedManager?: AuthUser | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  archivedAt?: string | Date | null;
  deletedAt?: string | Date | null;
  contacts?: ClientContact[];
  notes?: ClientNote[];
  files?: ClientFile[];
  projects?: Project[];
  activities?: ClientActivity[];
  invoices?: Invoice[];
  quotations?: Quotation[];
}

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  whatsapp?: string | null;
  primaryContact: boolean;
  createdAt: string | Date;
}

export interface ClientNote {
  id: string;
  clientId: string;
  userId: string;
  user?: AuthUser;
  note: string;
  createdAt: string | Date;
}

export interface ClientFile {
  id: string;
  clientId: string;
  name: string;
  type: string;
  size: number;
  url: string;
  createdAt: string | Date;
}

export interface ClientActivity {
  id: string;
  clientId: string;
  type: string;
  description: string;
  createdAt: string | Date;
}

export interface Project {
  id: string;
  clientId: string;
  client?: Client;
  projectName: string;
  projectCode: string;
  description: string;
  status: string;
  priority: string;
  budget: number;
  estimatedHours: number;
  actualHours: number;
  startDate: string | Date;
  deadline: string | Date;
  completionDate?: string | Date | null;
  progress: number;
  healthStatus: string;
  projectManagerId: string;
  projectManager?: AuthUser;
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  archivedAt?: string | Date | null;
  deletedAt?: string | Date | null;
  projectMembers?: ProjectMember[];
  milestones?: Milestone[];
  notes?: ProjectNote[];
  files?: ProjectFile[];
  meetings?: ProjectMeeting[];
  meetingsLinked?: Meeting[];
  timeLogs?: TimeLog[];
  deployments?: ProjectDeployment[];
  activities?: ProjectActivity[];
  invoices?: Invoice[];
  quotations?: Quotation[];
  expenses?: Expense[];
  billingPlan?: BillingPlan | null;
  recurringServices?: RecurringService[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user?: AuthUser;
  projectRole: ProjectRole;
  joinedAt: string | Date;
  assignedById?: string | null;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  dueDate: string | Date;
  status: string;
  progress: number;
  createdAt: string | Date;
}

export interface ProjectNote {
  id: string;
  projectId: string;
  userId: string;
  user?: AuthUser;
  note: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  type: string;
  size: number;
  url: string;
  folder: string;
  createdAt: string | Date;
}

export interface ProjectMeeting {
  id: string;
  projectId: string;
  title: string;
  date: string | Date;
  participants: string;
  platform: string;
  notes?: string | null;
  actionItems?: string | null;
  createdAt: string | Date;
}

export interface ProjectDeployment {
  id: string;
  projectId: string;
  environment: string;
  repositoryUrl: string;
  hostingProvider: string;
  branch: string;
  commitHash?: string | null;
  productionUrl?: string | null;
  stagingUrl?: string | null;
  status: string;
  version: string;
  createdAt: string | Date;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  type: string;
  description: string;
  createdAt: string | Date;
}

export interface Task {
  id: string;
  projectId: string;
  project?: Project;
  parentTaskId?: string | null;
  parentTask?: Task | null;
  subtasks?: Task[];
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  estimatedHours: number;
  actualHours: number;
  storyPoints?: number | null;
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  completedAt?: string | Date | null;
  position: number;
  createdBy: string;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;

  assignees?: AuthUser[];
  comments?: TaskComment[];
  checklist?: TaskChecklist[];
  attachments?: TaskAttachment[];
  activities?: TaskActivity[];
  labels?: TaskLabel[];
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  user?: AuthUser;
  comment: string;
  edited: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface TaskChecklist {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  order: number;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  name: string;
  url: string;
  size: number;
  uploadedById: string;
  uploadedBy?: AuthUser;
  uploadedAt: string | Date;
}

export interface TaskLabel {
  id: string;
  name: string;
  color: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  type: string;
  description: string;
  createdAt: string | Date;
}

export interface TimeLog {
  id: string;
  userId: string;
  user?: AuthUser;
  projectId: string;
  project?: Project;
  taskId?: string | null;
  task?: Task | null;
  description: string;
  startTime: string | Date;
  endTime?: string | Date | null;
  duration: number;
  billable: boolean;
  hourlyRateSnapshot: number;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Meeting {
  id: string;
  projectId?: string | null;
  project?: Project | null;
  title: string;
  description?: string | null;
  startTime: string | Date;
  endTime: string | Date;
  meetingType: string;
  platform: string;
  meetingLink: string;
  organizerId: string;
  organizer?: AuthUser;
  createdAt: string | Date;
  participants?: MeetingParticipant[];
}

export interface MeetingParticipant {
  meetingId: string;
  userId: string;
  user?: AuthUser;
  attendanceStatus: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  eventType: string;
  startTime: string | Date;
  endTime: string | Date;
  userId: string;
  user?: AuthUser;
  projectId?: string | null;
  project?: Project | null;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
  createdAt: string | Date;
}

export interface QuotationBillingDraft {
  billingType: BillingPlanType;
  stages: { name: string; percentage: number; amount: number; dueDate?: string | null }[];
  monthlyAmount?: number | null;
  retainerStart?: string | null;
  retainerDuration?: number | null; // months
}

export interface QuotationAttachment {
  name: string;
  url: string;
  type: string; // 'PDF', 'DOC', 'MOCKUP', 'CONTRACT', 'OTHER'
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  clientId: string;
  client?: Client;
  projectId?: string | null;
  project?: Project | null;
  title: string;
  description?: string | null;
  quoteDate?: string | Date;
  validUntil: string | Date;
  currency?: string;
  status: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string | null;
  scope?: string | null;
  termsConditions?: string | null;
  internalNotes?: string | null;
  billingPlanDraft?: QuotationBillingDraft | null;
  attachments?: QuotationAttachment[];
  createdBy: string;
  creator?: AuthUser;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;
  items?: QuotationItem[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
  createdAt: string | Date;
}

export interface InvoiceAttachment {
  name: string;
  url: string;
  type: string;
}

export interface InvoiceActivity {
  id: string;
  invoiceId: string;
  userId?: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
  action: string;
  description: string;
  createdAt: string | Date;
}

export type InvoiceType =
  'PROJECT' | 'ADVANCE' | 'MILESTONE' | 'FINAL' | 'RECURRING' | 'CREDIT_NOTE';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client?: Client;
  projectId?: string | null;
  project?: Project | null;
  title?: string;
  scope?: string | null;
  issueDate: string | Date;
  dueDate: string | Date;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string | null;
  termsConditions?: string | null;
  internalNotes?: string | null;
  attachments?: InvoiceAttachment[] | null;
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  createdBy: string;
  creator?: AuthUser;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;
  items?: InvoiceItem[];
  payments?: Payment[];
  billingStageId?: string | null;
  billingStage?: BillingStage | null;
  type: InvoiceType;
  billingPeriodFrom?: string | Date | null;
  billingPeriodTo?: string | Date | null;
  recurringServiceId?: string | null;
  recurringService?: RecurringService | null;
  originalInvoiceId?: string | null;
  revisionNumber?: number;
  activities?: InvoiceActivity[];
}

export interface Payment {
  id: string;
  invoiceId: string;
  invoice?: Invoice;
  clientId: string;
  client?: Client;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string | null;
  paymentDate: string | Date;
  notes?: string | null;
  recordedBy: string;
  recorder?: AuthUser;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Expense {
  id: string;
  projectId: string;
  project?: Project;
  category: string;
  amount: number;
  description: string;
  receiptUrl?: string | null;
  expenseDate: string | Date;
  recordedBy: string;
  recorder?: AuthUser;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;
}

export interface FinanceSummary {
  revenue: number;
  outstanding: number;
  expenses: number;
  profit: number;
  draftQuotes: number;
  openInvoices: number;
  mrr?: number;
  arr?: number;
  activeContracts?: number;
  pausedContracts?: number;
  cancelledContracts?: number;
  revenueForecast?: number;
  recurringRevenue?: number;
}

export type BillingPlanType =
  'FULL_PAYMENT' | 'ADVANCE_BALANCE' | 'MILESTONE' | 'MONTHLY_RETAINER' | 'AMC' | 'CUSTOM';

export type RecurringServiceInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RecurringServiceStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export interface BillingPlan {
  id: string;
  projectId: string;
  project?: Project;
  billingType: BillingPlanType;
  totalAmount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  stages?: BillingStage[];
}

export interface BillingStage {
  id: string;
  billingPlanId: string;
  billingPlan?: BillingPlan;
  name: string;
  amount: number;
  dueDate?: string | Date | null;
  status: string; // 'PENDING', 'INVOICED', 'PAID'
  createdAt: string | Date;
  updatedAt: string | Date;
  invoice?: Invoice | null;
}

export interface RecurringService {
  id: string;
  projectId: string;
  project?: Project;
  name: string;
  amount: number;
  interval: RecurringServiceInterval;
  status: RecurringServiceStatus;
  startDate: string | Date;
  nextInvoiceDate: string | Date;
  lastInvoicedDate?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}
