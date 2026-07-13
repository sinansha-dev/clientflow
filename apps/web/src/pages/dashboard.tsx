import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useToastStore } from '../stores/toast-store';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { CreateTaskModal } from '../components/tasks/create-task-modal';
import { ProjectWizard } from '../components/projects/project-wizard';
import type { Project, Task, ProjectTeam, TimeLog, Invoice, Meeting } from '@clientflow/types';
import {
  Lock,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Check,
  TrendingUp,
  Briefcase,
  AlertTriangle,
  Clock,
  DollarSign,
  Calendar,
  Activity,
  Video,
  Award,
  Settings,
  Eye,
  EyeOff,
  Bell,
  CheckCircle,
} from 'lucide-react';

type DashboardDensity = 'comfortable' | 'compact';

type WidgetId =
  | 'stats'
  | 'revenue'
  | 'my-tasks'
  | 'projects'
  | 'meetings'
  | 'team-productivity'
  | 'activity'
  | 'project-status'
  | 'notifications'
  | 'time-tracking';

interface WidgetConfig {
  id: WidgetId;
  title: string;
  visible: boolean;
  collapsed: boolean;
}

interface ClientApproval {
  id: string;
  status: string;
  title: string;
  createdAt: string;
}

interface DeveloperProductivity {
  name: string;
  hours: number;
  status: string;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const notify = useToastStore((state) => state.notify);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [approvals, setApprovals] = useState<ClientApproval[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Widget settings configuration
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const stored = localStorage.getItem('dashboard-widgets-config');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse widget layout', e);
      }
    }
    return [
      { id: 'stats', title: 'Workplace Metrics', visible: true, collapsed: false },
      { id: 'time-tracking', title: 'Time Tracking Overview', visible: true, collapsed: false },
      { id: 'revenue', title: 'Revenue Analytics', visible: true, collapsed: false },
      { id: 'my-tasks', title: 'My Tasks Checklist', visible: true, collapsed: false },
      { id: 'projects', title: 'Active Projects Grid', visible: true, collapsed: false },
      { id: 'meetings', title: 'Upcoming Client Meetings', visible: true, collapsed: false },
      { id: 'team-productivity', title: 'Team Productivity', visible: true, collapsed: false },
      { id: 'activity', title: 'Recent Activity Logs', visible: true, collapsed: false },
      {
        id: 'project-status',
        title: 'Projects Status Distribution',
        visible: true,
        collapsed: false,
      },
      { id: 'notifications', title: 'Workspace Notifications', visible: true, collapsed: false },
    ];
  });

  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [revenueFilter, setRevenueFilter] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [hoveredBar, setHoveredBar] = useState<{
    index: number;
    x: number;
    y: number;
    val: number;
  } | null>(null);

  // Modals
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const [dashboardDensity, setDashboardDensity] = useState<DashboardDensity>(() => {
    const stored = localStorage.getItem('workspace-density') as DashboardDensity | null;
    return stored === 'compact' ? stored : 'comfortable';
  });

  // Tab state for My Tasks
  const [taskTab, setTaskTab] = useState<'upcoming' | 'today' | 'overdue' | 'completed'>(
    'upcoming',
  );

  const fetchDashboardStats = useCallback(async () => {
    try {
      const [prjRes, taskRes, invRes, meetRes, appRes, timeRes] = await Promise.all([
        api.get('/projects?limit=1000'),
        api.get('/tasks'),
        api.get('/invoices').catch(() => ({ data: { data: [] } })),
        api.get('/meetings').catch(() => ({ data: { data: [] } })),
        api.get('/approvals').catch(() => ({ data: { data: [] } })),
        api.get('/timelogs').catch(() => ({ data: { data: [] } })),
      ]);

      setProjects(prjRes.data.data?.items ?? []);
      setTasks(taskRes.data.data ?? []);
      setInvoices(invRes.data?.data ?? []);
      setMeetings(meetRes.data?.data ?? []);

      const approvalsData = appRes.data?.data;
      const approvalsArray = Array.isArray(approvalsData)
        ? approvalsData
        : Array.isArray(approvalsData?.approvals)
          ? approvalsData.approvals
          : [];
      setApprovals(approvalsArray);

      setTimeLogs(timeRes.data?.data ?? []);
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
      notify({
        type: 'error',
        title: 'Load Failed',
        message: errorMessage(err, 'Failed to retrieve workspace data.'),
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  useEffect(() => {
    const syncWorkspacePreferences = () => {
      const storedDensity = localStorage.getItem('workspace-density') as DashboardDensity | null;
      setDashboardDensity(storedDensity === 'compact' ? 'compact' : 'comfortable');
    };

    syncWorkspacePreferences();
    window.addEventListener('workspace-preferences-changed', syncWorkspacePreferences);
    return () => {
      window.removeEventListener('workspace-preferences-changed', syncWorkspacePreferences);
    };
  }, []);

  const saveWidgetConfig = (newWidgets: WidgetConfig[]) => {
    setWidgets(newWidgets);
    localStorage.setItem('dashboard-widgets-config', JSON.stringify(newWidgets));
  };

  const toggleWidgetCollapse = (id: WidgetId) => {
    const next = widgets.map((w) => (w.id === id ? { ...w, collapsed: !w.collapsed } : w));
    saveWidgetConfig(next);
  };

  const toggleWidgetVisibility = (id: WidgetId) => {
    const next = widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
    saveWidgetConfig(next);
  };

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= widgets.length) return;
    const next = [...widgets];
    const temp = next[index];
    const target = next[nextIndex];
    if (temp && target) {
      next[index] = target;
      next[nextIndex] = temp;
      saveWidgetConfig(next);
    }
  };

  // Date Formatting
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Dynamic Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = user?.firstName ? user.firstName : 'User';
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  // Calculations for dashboard
  const activeProjectsCount = projects.filter(
    (p) => p.status === 'IN_PROGRESS' || p.status === 'PLANNING',
  ).length;
  const completedProjectsCount = projects.filter((p) => p.status === 'COMPLETED').length;

  const myTasks = tasks.filter((t) => t.assignees?.some((a) => a.id === user?.id));
  const completedTasksCount = myTasks.filter((t) => t.status === 'COMPLETED').length;
  const pendingTasksCount = myTasks.filter((t) => t.status !== 'COMPLETED').length;

  const overdueTasksCount = myTasks.filter((t) => {
    if (t.status === 'COMPLETED' || !t.dueDate) return false;
    return new Date(t.dueDate) < new Date();
  }).length;

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
  const totalOutstanding = invoices
    .filter((inv) => inv.status !== 'VOID')
    .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);

  const pendingClientApprovalsCount = approvals.filter((app) => app.status === 'PENDING').length;
  const upcomingMeetingsCount = meetings.filter((m) => new Date(m.startTime) >= new Date()).length;

  // Collaborators
  const collaboratorIds = new Set<string>();
  projects.forEach((p) => {
    if (p.projectManagerId && p.projectManagerId !== user?.id) {
      collaboratorIds.add(p.projectManagerId);
    }
    if (p.projectMembers) {
      p.projectMembers.forEach((member: ProjectTeam) => {
        if (member?.userId && member.userId !== user?.id) {
          collaboratorIds.add(member.userId);
        }
      });
    }
  });
  const collaboratorsCount = collaboratorIds.size;

  // Filter Tasks
  const getFilteredTasks = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    if (taskTab === 'completed') {
      return myTasks.filter((t) => t.status === 'COMPLETED');
    }

    if (taskTab === 'overdue') {
      return myTasks.filter((t) => {
        if (t.status === 'COMPLETED' || !t.dueDate) return false;
        return new Date(t.dueDate) < today;
      });
    }

    if (taskTab === 'today') {
      return myTasks.filter((t) => {
        if (t.status === 'COMPLETED' || !t.dueDate) return false;
        const due = new Date(t.dueDate);
        return due >= today && due <= endOfToday;
      });
    }

    // Upcoming (due in future, after today)
    return myTasks.filter((t) => {
      if (t.status === 'COMPLETED') return false;
      if (!t.dueDate) return true;
      return new Date(t.dueDate) > endOfToday;
    });
  };

  const filteredTasks = getFilteredTasks();
  const canCreateTasks = user?.role === 'ADMIN' || user?.role === 'STAFF';
  const padding = dashboardDensity === 'compact' ? 'p-4' : 'p-6';

  const toggleTaskCompletion = async (task: Task) => {
    const isNowCompleted = task.status !== 'COMPLETED';
    const newStatus = isNowCompleted ? 'COMPLETED' : 'TODO';

    // Optimistic Update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: newStatus,
              completedAt: isNowCompleted ? new Date().toISOString() : null,
            }
          : t,
      ),
    );

    try {
      await api.patch(`/tasks/${task.id}`, { status: newStatus });
      notify({
        type: 'success',
        title: isNowCompleted ? 'Task completed' : 'Task marked incomplete',
        message: `"${task.title}" updated.`,
      });
      const taskRes = await api.get('/tasks');
      setTasks(taskRes.data.data ?? []);
    } catch (err) {
      console.error('Failed to toggle task completion:', err);
      notify({
        type: 'error',
        title: 'Status Update Failed',
        message: errorMessage(err, 'Could not sync task status.'),
      });
      fetchDashboardStats();
    }
  };

  const formatTaskDate = (due: string | Date | null | undefined) => {
    if (!due) return '';
    const date = new Date(due);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Dynamic revenue calculation from actual invoices
  const getDynamicRevenueChartData = () => {
    const weeklyMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const monthlyMap = {
      Jan: 0,
      Feb: 0,
      Mar: 0,
      Apr: 0,
      May: 0,
      Jun: 0,
      Jul: 0,
      Aug: 0,
      Sep: 0,
      Oct: 0,
      Nov: 0,
      Dec: 0,
    };
    const yearlyMap: Record<string, number> = {};

    const now = new Date();
    const currentYear = now.getFullYear();

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthsOfYear = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    invoices.forEach((inv) => {
      if (!inv.amountPaid || inv.amountPaid <= 0) return;

      const date = new Date(inv.issueDate || inv.createdAt);
      const year = date.getFullYear();
      const amount = Number(inv.amountPaid);

      // Yearly grouping
      const yearStr = String(year);
      yearlyMap[yearStr] = (yearlyMap[yearStr] || 0) + amount;

      // Monthly grouping (current year)
      if (year === currentYear) {
        const monthIndex = date.getMonth();
        const monthName = monthsOfYear[monthIndex];
        if (monthName && monthName in monthlyMap) {
          monthlyMap[monthName as keyof typeof monthlyMap] += amount;
        }
      }

      // Weekly grouping (within last 7 days)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      if (date >= oneWeekAgo && date <= now) {
        const dayIndex = date.getDay();
        const dayName = daysOfWeek[dayIndex];
        if (dayName && dayName in weeklyMap) {
          weeklyMap[dayName as keyof typeof weeklyMap] += amount;
        }
      }
    });

    const weekly = Object.entries(weeklyMap).map(([name, amount]) => ({ name, amount }));
    const monthly = Object.entries(monthlyMap).map(([name, amount]) => ({ name, amount }));

    // Sort years ascending
    const sortedYears = Object.keys(yearlyMap).sort();
    if (sortedYears.length === 0) {
      sortedYears.push(String(currentYear - 2), String(currentYear - 1), String(currentYear));
    }
    const yearly = sortedYears.map((name) => ({
      name,
      amount: yearlyMap[name] || 0,
    }));

    return { weekly, monthly, yearly };
  };

  const revenueChartData = getDynamicRevenueChartData();

  // Dynamic Activity Logs helper
  const getDynamicActivityLogs = () => {
    const allActivities = projects.flatMap((p) => {
      const pActivities = p.activities || [];
      return pActivities.map((act) => ({
        ...act,
        projectName: p.projectName,
        projectCode: p.projectCode,
      }));
    });

    return allActivities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  };

  const getRelativeTime = (dateString: string | Date) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const recentActivities = getDynamicActivityLogs();

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-foreground/50">
            Loading ClientFlow dashboard...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 p-6 rounded-2xl border border-border/60">
        <div>
          <span className="text-xs font-bold text-primary tracking-wide uppercase">
            {formattedDate}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            {getGreeting()}
          </h1>
          <p className="text-xs text-foreground/50 mt-1">
            Here is a summary of what's happening at your agency today. You have completed{' '}
            {completedTasksCount} tasks so far!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Customize Layout Trigger */}
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className="flex items-center gap-1.5 px-3 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Customize layout</span>
          </button>

          <button
            onClick={() => setIsCreateProjectOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/10"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* Widget customization settings panel */}
      {showConfigPanel && (
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xl space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/60 flex items-center gap-1.5">
              <Settings className="h-4 w-4 text-primary" /> Customize Workspace Dashboard
            </h3>
            <button
              onClick={() => setShowConfigPanel(false)}
              className="text-xs font-bold text-primary hover:underline"
            >
              Done
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 text-xs font-medium">
            {widgets
              .filter((w) => !(w.id === 'revenue' && user?.role === 'STAFF'))
              .map((widget, index) => (
                <div
                  key={widget.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-background/50 hover:bg-background transition"
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleWidgetVisibility(widget.id)}
                      className="p-1 hover:bg-muted rounded text-foreground/75"
                      title={widget.visible ? 'Hide widget' : 'Show widget'}
                    >
                      {widget.visible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-foreground/35" />
                      )}
                    </button>
                    <span className={widget.visible ? 'text-foreground' : 'text-foreground/40'}>
                      {widget.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => moveWidget(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-muted rounded text-foreground/50 disabled:opacity-20"
                      title="Move Up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveWidget(index, 'down')}
                      disabled={index === widgets.length - 1}
                      className="p-1 hover:bg-muted rounded text-foreground/50 disabled:opacity-20"
                      title="Move Down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Render Dynamic Layout Flow */}
      <div className="space-y-6">
        {widgets
          .filter((w) => w.visible)
          .filter((w) => !(w.id === 'revenue' && user?.role === 'STAFF'))
          .map((widget) => {
            const collapseToggle = (
              <button
                onClick={() => toggleWidgetCollapse(widget.id)}
                className="p-1.5 text-foreground/45 hover:text-foreground hover:bg-muted rounded-lg transition"
                title={widget.collapsed ? 'Expand' : 'Collapse'}
              >
                {widget.collapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </button>
            );

            // RENDER INDIVIDUAL WIDGETS
            if (widget.id === 'stats') {
              return (
                <div key={widget.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/55 flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-primary" /> {widget.title}
                    </h2>
                    {collapseToggle}
                  </div>
                  {!widget.collapsed && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Active Projects */}
                      <div className="bg-card border border-border hover:border-primary/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between h-28 group">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                            Active Projects
                          </span>
                          <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/10 group-hover:scale-105 transition-transform">
                            <Briefcase className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-bold text-foreground">
                            {activeProjectsCount}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                            <TrendingUp className="h-3 w-3" /> +1
                          </span>
                        </div>
                      </div>

                      {/* Completed Projects */}
                      <div className="bg-card border border-border hover:border-primary/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between h-28 group">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                            Completed Projects
                          </span>
                          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/10 group-hover:scale-105 transition-transform">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-bold text-foreground">
                            {completedProjectsCount}
                          </span>
                        </div>
                      </div>

                      {/* Pending Tasks */}
                      <div className="bg-card border border-border hover:border-secondary/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between h-28 group">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                            Pending Tasks
                          </span>
                          <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/10 group-hover:scale-105 transition-transform">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-bold text-foreground">
                            {pendingTasksCount}
                          </span>
                          {overdueTasksCount > 0 && (
                            <span className="text-[10px] font-bold text-danger flex items-center gap-0.5 bg-danger/10 px-1.5 py-0.5 rounded-full">
                              <AlertTriangle className="h-3 w-3" /> {overdueTasksCount} overdue
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Overdue Tasks */}
                      <div className="bg-card border border-border hover:border-secondary/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between h-28 group">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                            Overdue Tasks
                          </span>
                          <div className="h-8 w-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/10 group-hover:scale-105 transition-transform">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-bold text-foreground">
                            {overdueTasksCount}
                          </span>
                        </div>
                      </div>

                      {/* Revenue Generated */}
                      {user?.role === 'ADMIN' && (
                        <div className="bg-card border border-border hover:border-accent/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between h-28 group">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                              Revenue Collected
                            </span>
                            <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/10 group-hover:scale-105 transition-transform">
                              <DollarSign className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="flex items-baseline gap-1 mt-2">
                            <span className="text-2xl font-bold text-foreground">
                              $
                              {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Outstanding payments */}
                      {user?.role === 'ADMIN' && (
                        <div className="bg-card border border-border hover:border-amber-500/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between h-28 group">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                              Outstanding Invoices
                            </span>
                            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/10 group-hover:scale-105 transition-transform">
                              <Clock className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-2xl font-bold text-foreground">
                              $
                              {totalOutstanding.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Pending Approvals */}
                      <div className="bg-card border border-border hover:border-primary/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between h-28 group">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                            Pending Approvals
                          </span>
                          <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/10 group-hover:scale-105 transition-transform">
                            <CheckCircle className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-bold text-foreground">
                            {pendingClientApprovalsCount}
                          </span>
                        </div>
                      </div>

                      {/* Upcoming Meetings */}
                      <div className="bg-card border border-border hover:border-primary/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between h-28 group">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                            Upcoming Meetings
                          </span>
                          <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/10 group-hover:scale-105 transition-transform">
                            <Calendar className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-bold text-foreground">
                            {upcomingMeetingsCount}
                          </span>
                          <span className="text-[9px] text-foreground/45">
                            Collaborators: {collaboratorsCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            if (widget.id === 'time-tracking') {
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const todayLogs = timeLogs.filter((l) => {
                const logDate = new Date(l.startTime);
                logDate.setHours(0, 0, 0, 0);
                return logDate.getTime() === today.getTime();
              });
              const todayTeamHours =
                Math.round(todayLogs.reduce((sum, l) => sum + Number(l.duration || 0), 0) * 100) /
                100;

              const runningTimers = timeLogs.filter((l) => l.endTime === null);

              const pendingApprovalsCount = timeLogs.filter(
                (l) => l.status === 'SUBMITTED' && l.endTime !== null,
              ).length;

              const startOfWeek = new Date();
              const day = startOfWeek.getDay();
              const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
              startOfWeek.setDate(diff);
              startOfWeek.setHours(0, 0, 0, 0);

              const projHoursMap: Record<string, number> = {};
              timeLogs.forEach((l) => {
                const logDate = new Date(l.startTime);
                if (logDate >= startOfWeek) {
                  const pName = l.project?.projectName || 'No Project';
                  projHoursMap[pName] = (projHoursMap[pName] || 0) + Number(l.duration || 0);
                }
              });
              const topProjects = Object.entries(projHoursMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

              const weeklyTrend: Record<string, number> = {};
              const daysOfWeekName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              daysOfWeekName.forEach((dayName) => (weeklyTrend[dayName] = 0));

              timeLogs.forEach((l) => {
                const logDate = new Date(l.startTime);
                if (logDate >= startOfWeek) {
                  const dayName = logDate.toLocaleDateString(undefined, { weekday: 'short' });
                  if (dayName in weeklyTrend) {
                    weeklyTrend[dayName] = (weeklyTrend[dayName] || 0) + Number(l.duration || 0);
                  }
                }
              });
              const weeklyTrendData = Object.entries(weeklyTrend).map(([name, hours]) => ({
                name,
                hours: Math.round(hours * 10) / 10,
              }));
              const maxWeeklyHours = Math.max(...weeklyTrendData.map((d) => d.hours), 1);

              return (
                <div key={widget.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/55 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" /> {widget.title}
                    </h2>
                    {collapseToggle}
                  </div>
                  {!widget.collapsed && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
                            Today's Team Hours
                          </span>
                          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <Clock className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="block text-2xl font-black text-foreground">
                            {todayTeamHours} hrs
                          </span>
                          <span className="text-[9px] text-foreground/45 mt-0.5 block font-semibold">
                            Total logged by team today
                          </span>
                        </div>
                      </div>

                      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
                            Running / Pending
                          </span>
                          <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center animate-pulse">
                            <Clock className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="block text-2xl font-black text-foreground">
                            {runningTimers.length} active / {pendingApprovalsCount} pending
                          </span>
                          <span className="text-[9px] text-foreground/45 mt-0.5 block font-semibold">
                            Stopwatches and submitted timesheets
                          </span>
                        </div>
                      </div>

                      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm lg:col-span-1 md:col-span-2">
                        <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5 block">
                          Weekly Hours Trend
                        </span>
                        <div className="h-14 flex items-end justify-between px-1">
                          {weeklyTrendData.map((d) => (
                            <div
                              key={d.name}
                              className="flex flex-col items-center flex-1 gap-1 group relative"
                            >
                              <div
                                className="w-4 rounded-t bg-primary/70 hover:bg-primary transition-all duration-200"
                                style={{
                                  height: `${Math.max(2, (d.hours / maxWeeklyHours) * 32)}px`,
                                }}
                                title={`${d.hours} hrs`}
                              />
                              <span className="text-[8px] font-bold text-foreground/40">
                                {d.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm md:col-span-2 lg:col-span-3">
                        <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-3 block">
                          Top Active Projects (This Week)
                        </span>
                        <div className="space-y-2.5 text-xs font-semibold">
                          {topProjects.map(([name, hours]) => {
                            const maxVal = Math.max(...topProjects.map((e) => e[1]), 1);
                            const pct = Math.round((hours / maxVal) * 100);
                            return (
                              <div key={name} className="flex items-center justify-between gap-4">
                                <span className="truncate w-1/3 text-foreground/80">{name}</span>
                                <div className="h-2 flex-1 rounded-full bg-border overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-primary font-bold w-12 text-right">
                                  {hours} hrs
                                </span>
                              </div>
                            );
                          })}
                          {topProjects.length === 0 && (
                            <div className="text-center py-2 text-foreground/45 italic">
                              No project hours logged this week.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            if (widget.id === 'revenue') {
              const activeData = revenueChartData[revenueFilter];
              const maxVal = Math.max(...activeData.map((d) => d.amount));

              return (
                <div key={widget.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/55 flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-primary" /> {widget.title}
                    </h2>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border">
                        {(['weekly', 'monthly', 'yearly'] as const).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setRevenueFilter(filter)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold capitalize transition-colors ${
                              revenueFilter === filter
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-foreground/45 hover:text-foreground'
                            }`}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>
                      {collapseToggle}
                    </div>
                  </div>
                  {!widget.collapsed && (
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm relative">
                      {/* Premium Custom Interactive SVG Chart */}
                      <div className="relative pt-6">
                        {hoveredBar && (
                          <div
                            className="absolute bg-foreground text-background text-[10px] font-bold py-1 px-2 rounded-lg pointer-events-none transform -translate-x-1/2 -translate-y-full shadow-lg border border-border"
                            style={{ left: hoveredBar.x, top: hoveredBar.y - 8 }}
                          >
                            ${hoveredBar.val.toLocaleString()}
                          </div>
                        )}
                        <svg
                          className="w-full h-44"
                          viewBox="0 0 600 180"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="0%"
                                stopColor="hsl(var(--primary))"
                                stopOpacity="0.45"
                              />
                              <stop
                                offset="100%"
                                stopColor="hsl(var(--primary))"
                                stopOpacity="0.02"
                              />
                            </linearGradient>
                          </defs>

                          {/* Grid Lines */}
                          <line
                            x1="0"
                            y1="0"
                            x2="600"
                            y2="0"
                            stroke="currentColor"
                            className="text-border/40"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                          <line
                            x1="0"
                            y1="50"
                            x2="600"
                            y2="50"
                            stroke="currentColor"
                            className="text-border/40"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                          <line
                            x1="0"
                            y1="100"
                            x2="600"
                            y2="100"
                            stroke="currentColor"
                            className="text-border/40"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                          <line
                            x1="0"
                            y1="150"
                            x2="600"
                            y2="150"
                            stroke="currentColor"
                            className="text-border/60"
                            strokeWidth="1"
                          />

                          {/* Render Bars */}
                          {activeData.map((d, index) => {
                            const barWidth = 40;
                            const spacing =
                              (600 - barWidth * activeData.length) / (activeData.length + 1);
                            const x = spacing + index * (barWidth + spacing);
                            const barHeight = (d.amount / (maxVal || 1)) * 140;
                            const y = 150 - barHeight;

                            return (
                              <g key={d.name}>
                                {/* Gradient bar */}
                                <rect
                                  x={x}
                                  y={y}
                                  width={barWidth}
                                  height={barHeight}
                                  rx="6"
                                  fill="url(#chartGradient)"
                                  className="transition-all duration-300"
                                />
                                {/* Overlay hover bar */}
                                <rect
                                  x={x}
                                  y={y}
                                  width={barWidth}
                                  height={barHeight}
                                  rx="6"
                                  fill="none"
                                  stroke="hsl(var(--primary))"
                                  strokeWidth={hoveredBar?.index === index ? '2.5' : '0'}
                                  className="transition-all duration-150 cursor-pointer"
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const parentRect =
                                      e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                    if (rect && parentRect) {
                                      setHoveredBar({
                                        index,
                                        x: rect.left - parentRect.left + barWidth / 2,
                                        y: rect.top - parentRect.top,
                                        val: d.amount,
                                      });
                                    }
                                  }}
                                  onMouseLeave={() => setHoveredBar(null)}
                                />
                                {/* Bottom label */}
                                <text
                                  x={x + barWidth / 2}
                                  y="170"
                                  textAnchor="middle"
                                  className="fill-foreground/45 text-[9px] font-bold font-sans"
                                >
                                  {d.name}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            if (widget.id === 'my-tasks') {
              return (
                <div key={widget.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/55 flex items-center gap-1.5">
                      <Lock className="h-4 w-4 text-primary" /> {widget.title}
                    </h2>
                    {collapseToggle}
                  </div>
                  {!widget.collapsed && (
                    <div
                      className={`bg-card border border-border rounded-2xl ${padding} shadow-sm space-y-4`}
                    >
                      {/* Tabs */}
                      <div className="flex border-b border-border gap-4 text-xs font-semibold overflow-x-auto">
                        {(['upcoming', 'today', 'overdue', 'completed'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setTaskTab(tab)}
                            className={`pb-2 capitalize shrink-0 transition relative ${
                              taskTab === tab
                                ? 'text-primary font-bold'
                                : 'text-foreground/50 hover:text-foreground'
                            }`}
                          >
                            {tab}
                            {taskTab === tab && (
                              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Create Task input button */}
                      {canCreateTasks && (
                        <button
                          onClick={() => setIsCreateTaskOpen(true)}
                          className="flex items-center gap-1.5 text-xs text-foreground/60 hover:text-primary border border-border hover:border-primary/20 bg-background/50 hover:bg-primary/5 px-3 py-2 rounded-xl transition w-full justify-center"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Create task</span>
                        </button>
                      )}

                      {/* Task Rows */}
                      <div className="divide-y divide-border/60">
                        {filteredTasks.length === 0 ? (
                          <div className="py-12 text-center text-xs text-foreground/45 italic">
                            No tasks found in this section
                          </div>
                        ) : (
                          filteredTasks.map((task) => (
                            <div
                              key={task.id}
                              className="py-3 flex items-center justify-between gap-3 text-xs group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  onClick={() => toggleTaskCompletion(task)}
                                  className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition ${
                                    task.status === 'COMPLETED'
                                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                                      : 'border-foreground/30 hover:border-foreground/60 text-transparent hover:text-foreground/40'
                                  }`}
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                                <span
                                  className={`truncate ${
                                    task.status === 'COMPLETED'
                                      ? 'line-through text-foreground/40'
                                      : 'text-foreground/80 font-semibold'
                                  }`}
                                >
                                  {task.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {task.project && (
                                  <span className="bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 text-[9px] rounded-md font-bold max-w-[100px] truncate">
                                    {task.project.projectName}
                                  </span>
                                )}
                                {task.dueDate && (
                                  <span
                                    className={`text-[10px] font-bold ${new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' ? 'text-danger bg-danger/10 px-1.5 py-0.5 rounded' : 'text-foreground/45'}`}
                                  >
                                    {formatTaskDate(task.dueDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            if (widget.id === 'projects') {
              return (
                <div key={widget.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/55 flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4 text-primary" /> {widget.title}
                    </h2>
                    {collapseToggle}
                  </div>
                  {!widget.collapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Create Project Card */}
                      <button
                        onClick={() => setIsCreateProjectOpen(true)}
                        className={`flex flex-col items-center justify-center p-5 bg-card hover:bg-primary/5 border border-dashed border-border hover:border-primary/40 rounded-2xl text-foreground/55 hover:text-primary transition group h-36`}
                      >
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary mb-3 transition">
                          <Plus className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-bold">New Project Setup</span>
                      </button>

                      {/* Active Projects rendering */}
                      {projects.slice(0, 5).map((p) => {
                        const progress = p.progress || 0;

                        return (
                          <div
                            key={p.id}
                            onClick={() => navigate(`/projects/${p.id}`)}
                            className="bg-card border border-border hover:border-primary/20 rounded-2xl p-4 shadow-sm hover:shadow-md cursor-pointer transition flex flex-col justify-between h-36 group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/15 font-bold text-sm shrink-0">
                                {p.projectName.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-foreground text-xs truncate leading-tight group-hover:text-primary transition-colors">
                                  {p.projectName}
                                </h4>
                                <span className="text-[10px] text-foreground/45 uppercase tracking-wide block mt-1 font-mono">
                                  Code: {p.projectCode}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1.5 pt-2">
                              <div className="flex justify-between text-[10px] font-bold text-foreground/60">
                                <span>Project progress</span>
                                <span>{progress}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (widget.id === 'meetings') {
              const activeMeetings = meetings.filter((m) => new Date(m.startTime) >= new Date());

              return (
                <div key={widget.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/55 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-primary" /> {widget.title}
                    </h2>
                    {collapseToggle}
                  </div>
                  {!widget.collapsed && (
                    <div
                      className={`bg-card border border-border rounded-2xl ${padding} shadow-sm space-y-3`}
                    >
                      {activeMeetings.length === 0 ? (
                        <div className="py-8 text-center text-xs text-foreground/45 italic">
                          No upcoming client meetings scheduled
                        </div>
                      ) : (
                        activeMeetings.map((m: Meeting) => (
                          <div
                            key={m.id}
                            className="flex justify-between items-center p-3 rounded-xl border border-border/70 hover:border-primary/20 bg-background/30 hover:bg-background/80 transition text-xs"
                          >
                            <div className="space-y-0.5">
                              <p className="font-bold text-foreground">{m.title}</p>
                              <p className="text-[10px] text-foreground/45">
                                {new Date(m.startTime).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            {m.meetingLink && (
                              <a
                                href={m.meetingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white transition font-bold text-[10px]"
                              >
                                <Video className="h-3 w-3" /> Meet
                              </a>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            }

            if (widget.id === 'team-productivity') {
              // Summarize timesheets/logged hours per developer
              const devWork = timeLogs.reduce((acc: Record<string, DeveloperProductivity>, log) => {
                const authorId = log.user?.id;
                if (!authorId) return acc;
                if (!acc[authorId]) {
                  const userName = log.user
                    ? `${log.user.firstName} ${log.user.lastName}`
                    : 'Unknown Member';
                  acc[authorId] = {
                    name: userName,
                    hours: 0,
                    status: 'Optimal',
                  };
                }
                const currentDev = acc[authorId];
                if (currentDev) {
                  currentDev.hours += Number(log.duration || 0);
                  currentDev.status = currentDev.hours > 40 ? 'Overloaded' : 'Optimal';
                }
                return acc;
              }, {});

              const devList = Object.values(devWork);

              return (
                <div key={widget.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/55 flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-primary" /> {widget.title}
                    </h2>
                    {collapseToggle}
                  </div>
                  {!widget.collapsed && (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm text-xs">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-muted/40 border-b border-border text-foreground/50 font-bold">
                            <th className="px-4 py-3">Member</th>
                            <th className="px-4 py-3">Logged Hours</th>
                            <th className="px-4 py-3">Workload Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {devList.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-8 text-center text-foreground/45 italic"
                              >
                                No productivity logs available this week
                              </td>
                            </tr>
                          ) : (
                            devList.map((dev: DeveloperProductivity) => {
                              const over = dev.hours > 40;
                              return (
                                <tr key={dev.name} className="hover:bg-muted/15 transition-colors">
                                  <td className="px-4 py-3 font-semibold text-foreground">
                                    {dev.name}
                                  </td>
                                  <td className="px-4 py-3 font-bold text-primary">
                                    {dev.hours} hrs
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[9px] font-bold ${over ? 'bg-danger/10 text-danger' : 'bg-emerald-500/10 text-emerald-600'}`}
                                    >
                                      {dev.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            }

            if (widget.id === 'project-status') {
              const statusCounts = projects.reduce((acc: Record<string, number>, p) => {
                acc[p.status] = (acc[p.status] || 0) + 1;
                return acc;
              }, {});

              const statuses = [
                'PLANNING',
                'IN_PROGRESS',
                'REVIEW',
                'TESTING',
                'COMPLETED',
                'CANCELLED',
              ];
              const statusColors = {
                PLANNING: 'bg-indigo-500',
                IN_PROGRESS: 'bg-blue-500',
                REVIEW: 'bg-purple-500',
                TESTING: 'bg-amber-500',
                COMPLETED: 'bg-emerald-500',
                CANCELLED: 'bg-danger',
              };

              return (
                <div key={widget.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/55 flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-primary" /> {widget.title}
                    </h2>
                    {collapseToggle}
                  </div>
                  {!widget.collapsed && (
                    <div
                      className={`bg-card border border-border rounded-2xl ${padding} shadow-sm space-y-4`}
                    >
                      <div className="h-4 w-full rounded-full bg-muted flex overflow-hidden">
                        {statuses.map((status) => {
                          const count = statusCounts[status] || 0;
                          const percent = projects.length ? (count / projects.length) * 100 : 0;
                          if (!percent) return null;
                          return (
                            <div
                              key={status}
                              className={statusColors[status as keyof typeof statusColors]}
                              style={{ width: `${percent}%` }}
                              title={`${status}: ${count}`}
                            />
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[10px] font-bold text-foreground/75">
                        {statuses.map((status) => {
                          const count = statusCounts[status] || 0;
                          const color = statusColors[status as keyof typeof statusColors];
                          return (
                            <div key={status} className="flex items-center gap-1.5">
                              <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                              <span className="capitalize">
                                {status.replace('_', ' ').toLowerCase()} ({count})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            if (widget.id === 'activity') {
              return (
                <div key={widget.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/55 flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-primary" /> {widget.title}
                    </h2>
                    {collapseToggle}
                  </div>
                  {!widget.collapsed && (
                    <div
                      className={`bg-card border border-border rounded-2xl ${padding} shadow-sm space-y-4`}
                    >
                      <div className="relative border-l border-border pl-4 space-y-4 text-xs">
                        {recentActivities.length === 0 ? (
                          <div className="py-6 text-center text-foreground/45 italic">
                            No activity recorded in this workspace.
                          </div>
                        ) : (
                          recentActivities.map((act) => {
                            let typeColor = 'bg-primary';
                            if (act.type.includes('MILESTONE') || act.type.includes('TASK')) {
                              typeColor = 'bg-emerald-500';
                            } else if (
                              act.type.includes('INVOICE') ||
                              act.type.includes('PAYMENT')
                            ) {
                              typeColor = 'bg-purple-500';
                            } else if (act.type.includes('DELETED')) {
                              typeColor = 'bg-danger';
                            }

                            return (
                              <div key={act.id} className="relative pl-1">
                                <span
                                  className={`absolute -left-[21px] top-0.5 ${typeColor} text-white h-3 w-3 rounded-full flex items-center justify-center border-2 border-card`}
                                />
                                <span className="font-semibold text-foreground">
                                  {act.description}
                                </span>
                                <span className="text-[10px] text-foreground/45 block mt-0.5">
                                  {act.projectName} • {getRelativeTime(act.createdAt)}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            if (widget.id === 'notifications') {
              return (
                <div key={widget.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/55 flex items-center gap-1.5">
                      <Bell className="h-4 w-4 text-primary" /> {widget.title}
                    </h2>
                    {collapseToggle}
                  </div>
                  {!widget.collapsed && (
                    <div
                      className={`bg-card border border-border rounded-2xl ${padding} shadow-sm space-y-3`}
                    >
                      <div className="flex gap-3 items-start border-b border-border/60 pb-2 text-xs">
                        <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-foreground">
                            Task approved by Project Manager
                          </p>
                          <span className="text-[10px] text-foreground/45 block mt-0.5">
                            2 hours ago
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start text-xs">
                        <div className="h-6 w-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-foreground">
                            Upcoming project milestone deadline approaching
                          </p>
                          <span className="text-[10px] text-foreground/45 block mt-0.5">
                            5 hours ago
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
      </div>

      {/* Modals */}
      {canCreateTasks && (
        <CreateTaskModal
          isOpen={isCreateTaskOpen}
          onClose={() => setIsCreateTaskOpen(false)}
          onSuccess={fetchDashboardStats}
          projects={projects}
        />
      )}

      {isCreateProjectOpen && (
        <ProjectWizard
          onClose={() => setIsCreateProjectOpen(false)}
          onSuccess={fetchDashboardStats}
        />
      )}
    </div>
  );
}
