import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const requiredUuidSchema = (label: string) =>
  z.string().trim().min(1, `${label} is required`).uuid(`Invalid ${label.toLowerCase()}`);
export const emailSchema = z.string().trim().email().toLowerCase();
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Phone number must be in international format')
  .optional()
  .or(z.literal(''));

export const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(24),
  password: passwordSchema,
});

export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  avatar: z.string().url().optional().or(z.literal('')),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const createUserSchema = profileSchema.extend({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['ADMIN', 'DEVELOPER', 'CLIENT']),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED']).default('ACTIVE'),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  emailVerified: z.boolean().optional(),
});

export const clientContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  position: z.string().trim().min(1, 'Position is required').max(100),
  email: emailSchema,
  phone: z.string().trim().min(1, 'Phone is required'),
  whatsapp: z.string().trim().optional().or(z.literal('')),
  primaryContact: z.boolean().default(false),
});

export const createClientSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(100),
  companyLogo: z.string().url('Invalid URL format').optional().or(z.literal('')),
  industry: z.string().trim().min(1, 'Industry is required').max(100),
  website: z.string().trim().url('Invalid website URL').min(1, 'Website is required'),
  email: emailSchema,
  phone: z.string().trim().min(1, 'Phone is required'),
  taxNumber: z.string().trim().optional().or(z.literal('')),
  billingAddress: z.string().trim().min(1, 'Billing address is required'),
  shippingAddress: z.string().trim().min(1, 'Shipping address is required'),
  country: z.string().trim().min(1, 'Country is required'),
  state: z.string().trim().min(1, 'State is required'),
  city: z.string().trim().min(1, 'City is required'),
  postalCode: z.string().trim().min(1, 'Postal code is required'),
  currency: z.string().trim().default('USD'),
  timezone: z.string().trim().default('UTC'),
  status: z.string().trim().default('ACTIVE'),
  source: z.string().trim().optional().or(z.literal('')),
  assignedManagerId: z.string().uuid().optional().nullable().or(z.literal('')),
  // Primary contact fields (for Step 3 of the creation wizard)
  primaryContact: clientContactSchema.omit({ primaryContact: true }).optional(),
});

export const updateClientSchema = createClientSchema.partial().omit({ primaryContact: true });

export const clientNoteSchema = z.object({
  note: z.string().trim().min(1, 'Note content is required'),
});

export const projectTeamMemberSchema = z.object({
  userId: uuidSchema,
  role: z.enum([
    'Project Manager',
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'UI/UX Designer',
    'QA Tester',
    'DevOps',
  ]),
});

export const createProjectBaseSchema = z.object({
  clientId: requiredUuidSchema('Client'),
  projectName: z.string().trim().min(1, 'Project name is required').max(150),
  description: z.string().trim().min(1, 'Description is required'),
  startDate: z.string().or(z.date()),
  deadline: z.string().or(z.date()),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  budget: z.coerce.number().positive('Budget must be a positive number'),
  estimatedHours: z.coerce.number().positive('Estimated hours must be a positive number'),
  status: z
    .enum([
      'PLANNING',
      'REQUIREMENTS',
      'DESIGN',
      'DEVELOPMENT',
      'TESTING',
      'CLIENT_REVIEW',
      'DEPLOYMENT',
      'MAINTENANCE',
      'COMPLETED',
      'ON_HOLD',
      'CANCELLED',
    ])
    .default('PLANNING'),
  projectManagerId: requiredUuidSchema('Project manager'),
  teamMembers: z.array(projectTeamMemberSchema).optional().default([]),
});

export const createProjectSchema = createProjectBaseSchema.refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.deadline);
    return end >= start;
  },
  {
    message: 'Deadline cannot be before Start Date',
    path: ['deadline'],
  },
);

export const updateProjectSchema = createProjectBaseSchema.partial();

export const milestoneSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  description: z.string().trim().optional().or(z.literal('')),
  dueDate: z.string().or(z.date()),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).default('PENDING'),
});

export const projectNoteSchema = z.object({
  note: z.string().trim().min(1, 'Note content is required'),
});

export const projectDeploymentSchema = z.object({
  environment: z.string().trim().min(1, 'Environment is required'),
  repositoryUrl: z
    .string()
    .trim()
    .url('Invalid repository URL')
    .min(1, 'Repository URL is required'),
  hostingProvider: z.string().trim().min(1, 'Hosting provider is required'),
  branch: z.string().trim().min(1, 'Branch is required'),
  commitHash: z.string().trim().optional().or(z.literal('')),
  productionUrl: z.string().trim().url('Invalid URL').optional().or(z.literal('')),
  stagingUrl: z.string().trim().url('Invalid URL').optional().or(z.literal('')),
  status: z.enum(['SUCCESS', 'FAILED', 'IN_PROGRESS']).default('SUCCESS'),
  version: z.string().trim().min(1, 'Version is required'),
});

export const taskCommentSchema = z.object({
  comment: z.string().trim().min(1, 'Comment content is required'),
});

export const taskChecklistSchema = z.object({
  title: z.string().trim().min(1, 'Checklist title is required').max(150),
  completed: z.boolean().default(false),
});

export const taskLabelSchema = z.object({
  name: z.string().trim().min(1, 'Label name is required').max(50),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color format')
    .default('#3B82F6'),
});

export const createTaskBaseSchema = z.object({
  projectId: uuidSchema,
  parentTaskId: uuidSchema.optional().nullable(),
  title: z.string().trim().min(1, 'Task title is required').max(150),
  description: z.string().trim().optional().or(z.literal('')),
  status: z
    .enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'TESTING', 'BLOCKED', 'COMPLETED'])
    .default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  estimatedHours: z.coerce.number().nonnegative('Estimated hours must be non-negative').default(0),
  actualHours: z.coerce.number().nonnegative('Actual hours must be non-negative').default(0),
  storyPoints: z.coerce.number().int().positive().optional().nullable(),
  startDate: z.string().or(z.date()).optional().nullable(),
  dueDate: z.string().or(z.date()).optional().nullable(),
  assigneeIds: z.array(uuidSchema).optional().default([]),
  labelIds: z.array(uuidSchema).optional().default([]),
});

export const createTaskSchema = createTaskBaseSchema.refine(
  (data) => {
    if (data.startDate && data.dueDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.dueDate);
      return end >= start;
    }
    return true;
  },
  {
    message: 'Due date cannot be before Start date',
    path: ['dueDate'],
  },
);

export const updateTaskSchema = createTaskBaseSchema.partial();

export const teamMemberProfileSchema = z.object({
  employeeId: z.string().trim().optional().nullable(),
  jobTitle: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  department: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  skills: z.array(z.string().trim()).default([]),
  hourlyRate: z.coerce
    .number()
    .nonnegative('Hourly rate must be zero or greater')
    .optional()
    .nullable(),
  employmentType: z
    .enum(['Full-Time', 'Part-Time', 'Freelancer', 'Contractor'])
    .default('Full-Time'),
  joinDate: z.string().or(z.date()).optional().nullable(),
  managerId: uuidSchema.optional().nullable(),
  availabilityStatus: z
    .enum(['Available', 'Busy', 'In Meeting', 'On Leave', 'Offline'])
    .default('Offline'),
  timezone: z.string().trim().default('UTC'),
});

export const timeLogBaseSchema = z.object({
  projectId: uuidSchema,
  taskId: uuidSchema.optional().nullable(),
  description: z.string().trim().min(1, 'Work description is required'),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()).optional().nullable(),
  billable: z.boolean().default(true),
});

export const timeLogSchema = timeLogBaseSchema.refine(
  (data) => {
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return end >= start;
    }
    return true;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  },
);

export const updateTimeLogSchema = timeLogBaseSchema.partial();

export const meetingBaseSchema = z.object({
  projectId: uuidSchema.optional().nullable(),
  title: z.string().trim().min(1, 'Meeting title is required').max(150),
  description: z.string().trim().optional().or(z.literal('')),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()),
  meetingType: z
    .enum(['INTERNAL', 'CLIENT', 'SPRINT_PLANNING', 'REVIEW', 'STAND_UP', 'DEMO'])
    .default('INTERNAL'),
  platform: z
    .enum(['GOOGLE_MEET', 'ZOOM', 'MICROSOFT_TEAMS', 'IN_PERSON', 'CUSTOM'])
    .default('GOOGLE_MEET'),
  meetingLink: z.string().trim().optional().or(z.literal('')),
  participantIds: z.array(uuidSchema).min(1, 'At least one participant is required'),
});

export const meetingSchema = meetingBaseSchema.refine(
  (data) => {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    return end > start;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  },
);

export const updateMeetingSchema = meetingBaseSchema.partial();

export const calendarEventBaseSchema = z.object({
  title: z.string().trim().min(1, 'Event title is required').max(150),
  description: z.string().trim().optional().or(z.literal('')),
  eventType: z
    .enum(['MEETING', 'DEADLINE', 'REMINDER', 'LEAVE', 'HOLIDAY', 'TASK_DUE_DATE'])
    .default('REMINDER'),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()),
  projectId: uuidSchema.optional().nullable(),
});

export const calendarEventSchema = calendarEventBaseSchema.refine(
  (data) => {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    return end >= start;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  },
);

export const updateCalendarEventSchema = calendarEventBaseSchema.partial();

export const portalFolderSchema = z.object({
  projectId: requiredUuidSchema('Project'),
  parentFolderId: uuidSchema.optional().nullable().or(z.literal('')),
  folderName: z.string().trim().min(1, 'Folder name is required').max(120),
});

export const portalFileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(180).optional(),
  folderId: uuidSchema.optional().nullable().or(z.literal('')),
  visibility: z.enum(['INTERNAL', 'CLIENT', 'PUBLIC_LINK']).optional(),
  deliverableStatus: z
    .enum(['DRAFT', 'READY_FOR_REVIEW', 'AWAITING_APPROVAL', 'APPROVED', 'ARCHIVED'])
    .optional(),
});

export const approvalDecisionSchema = z.object({
  comments: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const revisionRequestSchema = z.object({
  projectId: requiredUuidSchema('Project'),
  deliverableId: requiredUuidSchema('Deliverable'),
  description: z.string().trim().min(1, 'Revision description is required').max(4000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

export const revisionUpdateSchema = z.object({
  description: z.string().trim().min(1).max(4000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED']).optional(),
});

export const portalMessageSchema = z.object({
  projectId: requiredUuidSchema('Project'),
  body: z.string().trim().min(1, 'Message is required').max(5000),
  internalOnly: z.boolean().optional().default(false),
});

export const portalMessageUpdateSchema = z.object({
  body: z.string().trim().min(1, 'Message is required').max(5000),
});
