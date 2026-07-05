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
} from 'lucide-react';

export const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/clients', icon: UsersRound },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Tasks', href: '/tasks', icon: ListTodo },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays },
  { label: 'Team', href: '/team', icon: Users },
  { label: 'Invoices', href: '/invoices', icon: CreditCard },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
];
