import type { ProjectRole, Role } from '@clientflow/types';

export const projectRoles = [
  'PROJECT_MANAGER',
  'LEAD_DEVELOPER',
  'DEVELOPER',
  'DESIGNER',
  'QA',
  'VIEWER',
] as const satisfies readonly ProjectRole[];

export const projectRoleLabels: Record<ProjectRole, string> = {
  PROJECT_MANAGER: 'Project Manager',
  LEAD_DEVELOPER: 'Lead Developer',
  DEVELOPER: 'Developer',
  DESIGNER: 'Designer',
  QA: 'QA',
  VIEWER: 'Viewer',
};

export type ProjectPermission =
  | 'project:view'
  | 'project:manage'
  | 'members:manage'
  | 'tasks:assign'
  | 'tasks:update-own'
  | 'files:view'
  | 'files:manage'
  | 'meetings:view'
  | 'meetings:manage'
  | 'billing:view'
  | 'timesheets:view'
  | 'timesheets:log'
  | 'timesheets:approve'
  | 'deployments:view';

const contributorPermissions: readonly ProjectPermission[] = [
  'project:view',
  'tasks:update-own',
  'files:view',
  'files:manage',
  'meetings:view',
  'timesheets:log',
  'deployments:view',
];

export const projectRolePermissions: Record<ProjectRole, readonly ProjectPermission[]> = {
  PROJECT_MANAGER: [
    'project:view',
    'project:manage',
    'members:manage',
    'tasks:assign',
    'tasks:update-own',
    'files:view',
    'files:manage',
    'meetings:view',
    'meetings:manage',
    'billing:view',
    'timesheets:view',
    'timesheets:log',
    'deployments:view',
  ],
  LEAD_DEVELOPER: [...contributorPermissions, 'tasks:assign'],
  DEVELOPER: contributorPermissions,
  DESIGNER: contributorPermissions,
  QA: contributorPermissions,
  VIEWER: ['project:view', 'files:view', 'meetings:view', 'deployments:view'],
};

export function hasProjectPermission(role: ProjectRole, permission: ProjectPermission): boolean {
  return projectRolePermissions[role].includes(permission);
}
export function canUseProjectPermission(
  globalRole: Role,
  projectRole: ProjectRole | null,
  permission: ProjectPermission,
): boolean {
  if (globalRole === 'ADMIN') return true;
  if (globalRole !== 'STAFF' || !projectRole) return false;
  return hasProjectPermission(projectRole, permission);
}
