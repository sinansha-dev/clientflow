import type { Role } from '@clientflow/types';

export const roles: Role[] = ['ADMIN', 'DEVELOPER', 'CLIENT'];

export const permissions = {
  ADMIN: ['*'],
  DEVELOPER: ['dashboard:view', 'profile:update', 'assigned:view'],
  CLIENT: ['dashboard:view', 'profile:update', 'own-projects:view'],
} as const satisfies Record<Role, readonly string[]>;

export function can(role: Role, permission: string): boolean {
  const grants: readonly string[] = permissions[role];
  return grants.includes('*') || grants.includes(permission);
}
