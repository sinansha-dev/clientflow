export type Role = 'ADMIN' | 'DEVELOPER' | 'CLIENT';
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
  activities?: ClientActivity[];
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
  teamMembers?: ProjectTeam[];
  milestones?: Milestone[];
  notes?: ProjectNote[];
  files?: ProjectFile[];
  meetings?: ProjectMeeting[];
  deployments?: ProjectDeployment[];
  activities?: ProjectActivity[];
}

export interface ProjectTeam {
  projectId: string;
  userId: string;
  user?: AuthUser;
  role: string;
  joinedDate: string | Date;
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
