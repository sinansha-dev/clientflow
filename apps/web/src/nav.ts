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
  Bell,
} from 'lucide-react';

import type { Role } from '@clientflow/types';

export type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
};

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'STAFF'] },
  { label: 'Clients', href: '/clients', icon: UsersRound, roles: ['ADMIN', 'STAFF'] },
  { label: 'Projects', href: '/projects', icon: FolderKanban, roles: ['ADMIN', 'STAFF'] },
  {
    label: 'Client Portal',
    href: '/portal',
    icon: ShieldCheck,
    roles: ['CLIENT'],
  },
  {
    label: 'Notifications',
    href: '/notifications',
    icon: Bell,
    roles: ['ADMIN', 'STAFF', 'CLIENT'],
  },
  { label: 'Tasks', href: '/tasks', icon: ListTodo, roles: ['ADMIN', 'STAFF'] },
  { label: 'Timesheets', href: '/timesheets', icon: Clock, roles: ['ADMIN', 'STAFF'] },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays, roles: ['ADMIN', 'STAFF'] },
  { label: 'Team', href: '/team', icon: Users, roles: ['ADMIN'] },
  { label: 'Finance', href: '/invoices', icon: CreditCard, roles: ['ADMIN'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['ADMIN'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN'] },
];
