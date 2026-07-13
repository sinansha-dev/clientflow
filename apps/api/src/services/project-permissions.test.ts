import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canUseProjectPermission,
  projectRolePermissions,
  type ProjectPermission,
} from '@clientflow/shared';
import type { ProjectRole } from '@clientflow/types';

const allPermissions = [
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
  'timesheets:approve',
  'deployments:view',
] as const satisfies readonly ProjectPermission[];

test('Admin has every project permission', () => {
  for (const permission of allPermissions) {
    assert.equal(canUseProjectPermission('ADMIN', null, permission), true);
  }
});

test('Staff without a ProjectMember assignment has no project permissions', () => {
  for (const permission of allPermissions) {
    assert.equal(canUseProjectPermission('STAFF', null, permission), false);
  }
});

test('removing a ProjectMember immediately revokes project access', () => {
  assert.equal(canUseProjectPermission('STAFF', 'DEVELOPER', 'project:view'), true);
  assert.equal(canUseProjectPermission('STAFF', null, 'project:view'), false);
});

test('Project Managers can manage assigned project work but cannot approve timesheets', () => {
  const allowed: ProjectPermission[] = [
    'project:view',
    'project:manage',
    'members:manage',
    'tasks:assign',
    'files:manage',
    'meetings:manage',
    'billing:view',
    'timesheets:view',
  ];
  for (const permission of allowed) {
    assert.equal(canUseProjectPermission('STAFF', 'PROJECT_MANAGER', permission), true);
  }
  assert.equal(canUseProjectPermission('STAFF', 'PROJECT_MANAGER', 'timesheets:approve'), false);
});

test('Lead Developers can assign tasks but cannot manage project settings or billing', () => {
  assert.equal(canUseProjectPermission('STAFF', 'LEAD_DEVELOPER', 'tasks:assign'), true);
  assert.equal(canUseProjectPermission('STAFF', 'LEAD_DEVELOPER', 'project:manage'), false);
  assert.equal(canUseProjectPermission('STAFF', 'LEAD_DEVELOPER', 'billing:view'), false);
});

test('contributor roles can update own work, log time, and upload files only', () => {
  const roles: ProjectRole[] = ['DEVELOPER', 'DESIGNER', 'QA'];
  for (const role of roles) {
    assert.equal(canUseProjectPermission('STAFF', role, 'tasks:update-own'), true);
    assert.equal(canUseProjectPermission('STAFF', role, 'timesheets:log'), true);
    assert.equal(canUseProjectPermission('STAFF', role, 'files:manage'), true);
    assert.equal(canUseProjectPermission('STAFF', role, 'tasks:assign'), false);
    assert.equal(canUseProjectPermission('STAFF', role, 'members:manage'), false);
    assert.equal(canUseProjectPermission('STAFF', role, 'billing:view'), false);
  }
});

test('Viewers have read-only project access', () => {
  assert.deepEqual(projectRolePermissions.VIEWER, [
    'project:view',
    'files:view',
    'meetings:view',
    'deployments:view',
  ]);
});

test('Clients never receive internal project-role permissions', () => {
  for (const permission of allPermissions) {
    assert.equal(canUseProjectPermission('CLIENT', 'PROJECT_MANAGER', permission), false);
  }
});
