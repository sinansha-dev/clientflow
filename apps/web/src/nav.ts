import {
  BarChart3,
  CalendarDays,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Settings,
  Users,
  UsersRound,
  Clock,
  ShieldCheck,
} from 'lucide-react';

import type { Role } from '@clientflow/types';

export type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
};

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'DEVELOPER'] },
  { label: 'Clients', href: '/clients', icon: UsersRound, roles: ['ADMIN', 'DEVELOPER'] },
  { label: 'Projects', href: '/projects', icon: FolderKanban, roles: ['ADMIN', 'DEVELOPER'] },
  {
    label: 'Client Portal',
    href: '/portal',
    icon: ShieldCheck,
    roles: ['ADMIN', 'DEVELOPER', 'CLIENT'],
  },
  { label: 'Tasks', href: '/tasks', icon: ListTodo, roles: ['ADMIN', 'DEVELOPER'] },
  { label: 'Timesheets', href: '/timesheets', icon: Clock, roles: ['ADMIN', 'DEVELOPER'] },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays, roles: ['ADMIN', 'DEVELOPER'] },
  { label: 'Team', href: '/team', icon: Users, roles: ['ADMIN', 'DEVELOPER'] },
  { label: 'Invoices', href: '/invoices', icon: CreditCard, roles: ['ADMIN', 'DEVELOPER'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['ADMIN', 'DEVELOPER'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN'] },
];
