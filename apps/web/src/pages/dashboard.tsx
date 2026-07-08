import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useToastStore } from '../stores/toast-store';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { CreateTaskModal } from '../components/tasks/create-task-modal';
import { ProjectWizard } from '../components/projects/project-wizard';
import type { Project, Task, ProjectTeam } from '@clientflow/types';
import {
  Lock,
  MoreHorizontal,
  Plus,
  CheckCircle2,
  UsersRound,
  ChevronDown,
  Check,
  Palette,
} from 'lucide-react';

type DashboardAccent = 'emerald' | 'blue' | 'rose' | 'amber';
type DashboardDensity = 'comfortable' | 'compact';

const accentStyles: Record<
  DashboardAccent,
  {
    label: string;
    swatch: string;
    text: string;
    bg: string;
    border: string;
    solid: string;
    shadow: string;
  }
> = {
  emerald: {
    label: 'Emerald',
    swatch: 'bg-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/25',
    solid: 'bg-emerald-500',
    shadow: 'shadow-emerald-500/10',
  },
  blue: {
    label: 'Blue',
    swatch: 'bg-[#4dabf7]',
    text: 'text-[#4dabf7]',
    bg: 'bg-[#4dabf7]/10',
    border: 'border-[#4dabf7]/25',
    solid: 'bg-blue-500',
    shadow: 'shadow-blue-500/10',
  },
  rose: {
    label: 'Rose',
    swatch: 'bg-[#ec8c9f]',
    text: 'text-[#ec8c9f]',
    bg: 'bg-[#ec8c9f]/10',
    border: 'border-[#ec8c9f]/25',
    solid: 'bg-[#ec8c9f]',
    shadow: 'shadow-[#ec8c9f]/10',
  },
  amber: {
    label: 'Amber',
    swatch: 'bg-[#f59f00]',
    text: 'text-[#f59f00]',
    bg: 'bg-[#f59f00]/10',
    border: 'border-[#f59f00]/25',
    solid: 'bg-[#f59f00]',
    shadow: 'shadow-[#f59f00]/10',
  },
};
export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const notify = useToastStore((state) => state.notify);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [dashboardAccent, setDashboardAccent] = useState<DashboardAccent>(() => {
    const stored = localStorage.getItem('dashboard-accent') as DashboardAccent | null;
    return stored && stored in accentStyles ? stored : 'blue';
  });
  const [dashboardDensity, setDashboardDensity] = useState<DashboardDensity>(() => {
    const stored = localStorage.getItem('dashboard-density') as DashboardDensity | null;
    return stored === 'compact' ? stored : 'comfortable';
  });

  // Tab state for My Tasks
  const [taskTab, setTaskTab] = useState<'upcoming' | 'overdue' | 'completed'>('upcoming');

  const fetchDashboardStats = useCallback(async () => {
    try {
      const [prjRes, taskRes] = await Promise.all([
        api.get('/projects?limit=1000'),
        api.get('/tasks'),
      ]);
      setProjects(prjRes.data.data?.items ?? []);
      setTasks(taskRes.data.data ?? []);
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
    localStorage.setItem('dashboard-accent', dashboardAccent);
  }, [dashboardAccent]);

  useEffect(() => {
    localStorage.setItem('dashboard-density', dashboardDensity);
  }, [dashboardDensity]);

  // Date Formatting
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Dynamic Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = user?.firstName ? user.firstName.toUpperCase() : 'USER';
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  // Initials for avatar
  const getInitials = () => {
    const first = user?.firstName?.charAt(0) || '';
    const last = user?.lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || 'CF';
  };

  // Calculations for Tasks Completed and Collaborators
  const myTasks = tasks.filter((t) => t.assignees?.some((a) => a.id === user?.id));
  const completedTasksCount = myTasks.filter((t) => t.status === 'COMPLETED').length;

  const collaboratorIds = new Set<string>();
  projects.forEach((p) => {
    if (p.projectManagerId && p.projectManagerId !== user?.id) {
      collaboratorIds.add(p.projectManagerId);
    }
    if (p.teamMembers) {
      p.teamMembers.forEach((member: ProjectTeam) => {
        if (!member) return;
        const id = member.userId;
        if (id && id !== user?.id) {
          collaboratorIds.add(id);
        }
      });
    }
  });
  const collaboratorsCount = collaboratorIds.size;

  // Task filtering based on selected tab
  const getFilteredTasks = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (taskTab === 'completed') {
      return myTasks.filter((t) => t.status === 'COMPLETED');
    }

    if (taskTab === 'overdue') {
      return myTasks.filter((t) => {
        if (t.status === 'COMPLETED' || !t.dueDate) return false;
        return new Date(t.dueDate) < today;
      });
    }

    // Upcoming
    return myTasks.filter((t) => {
      if (t.status === 'COMPLETED') return false;
      if (!t.dueDate) return true;
      return new Date(t.dueDate) >= today;
    });
  };

  const filteredTasks = getFilteredTasks();
  const canCreateTasks = user?.role === 'ADMIN';
  const accent = accentStyles[dashboardAccent];
  const panelPadding = dashboardDensity === 'compact' ? 'p-4' : 'p-6';
  const panelMinHeight = dashboardDensity === 'compact' ? 'min-h-[380px]' : 'min-h-[480px]';
  const projectCardMinHeight = dashboardDensity === 'compact' ? 'min-h-[112px]' : 'min-h-[140px]';

  // Tasks due soon text for projects
  const getTasksDueSoon = (projId: string) => {
    const projTasks = tasks.filter((t) => t.projectId === projId && t.status !== 'COMPLETED');
    const soonCount = projTasks.length;
    if (soonCount === 0) return 'No tasks remaining';
    if (soonCount === 1) return '1 task due soon';
    return `${soonCount} tasks due soon`;
  };

  // Task Completion Toggler
  const toggleTaskCompletion = async (task: Task) => {
    const isNowCompleted = task.status !== 'COMPLETED';
    const newStatus = isNowCompleted ? 'COMPLETED' : 'TODO';

    // Optimistic UI Update
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
      // Fetch latest states in background
      const taskRes = await api.get('/tasks');
      setTasks(taskRes.data.data ?? []);
    } catch (err) {
      console.error('Failed to toggle task completion status:', err);
      notify({
        type: 'error',
        title: 'Status Update Failed',
        message: errorMessage(err, 'Could not sync task status.'),
      });
      // Rollback
      fetchDashboardStats();
    }
  };

  // Date Formatter helper for task row (e.g. "7 - 9 Jul" or "25 Jul")
  const formatTaskDate = (
    start: string | Date | null | undefined,
    due: string | Date | null | undefined,
  ) => {
    if (!due) return '';
    const months = [
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
    const dueD = new Date(due);
    const dueDay = dueD.getDate();
    const dueMonth = months[dueD.getMonth()];

    if (start) {
      const startD = new Date(start);
      const startDay = startD.getDate();
      const startMonth = months[startD.getMonth()];
      if (startMonth === dueMonth) {
        return `${startDay} - ${dueDay} ${dueMonth}`;
      } else {
        return `${startDay} ${startMonth} - ${dueDay} ${dueMonth}`;
      }
    }
    return `${dueDay} ${dueMonth}`;
  };

  if (loading) {
    return (
      <div className="-mx-4 -my-6 md:-mx-8 p-6 md:p-8 min-h-[calc(100vh-10rem)] bg-gradient-to-br from-[#192723] via-[#121817] to-[#0d0e0e] text-[#f5f6f6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-zinc-400">Loading your workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-6 md:-mx-8 p-6 md:p-8 min-h-[calc(100vh-10rem)] bg-gradient-to-br from-[#192723] via-[#121817] to-[#0d0e0e] text-[#f5f6f6] font-sans antialiased">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <span className="text-sm font-medium text-zinc-400">{formattedDate}</span>
          <h1 className="text-3xl font-semibold tracking-tight text-white mt-1">{getGreeting()}</h1>
        </div>

        {/* Action pills */}
        <div className="flex flex-wrap items-center gap-2 text-zinc-300">
          <button className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-full text-xs font-medium border border-white/5 transition">
            <span>My week</span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </button>

          <div className="flex items-center gap-4 px-4 py-1.5 bg-white/10 rounded-full text-xs font-medium border border-white/5 text-zinc-300">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {completedTasksCount} tasks completed
            </span>
            <div className="h-3.5 w-[1px] bg-white/10" />
            <span className="flex items-center gap-1.5">
              <UsersRound className="h-4 w-4 text-blue-400" />
              {collaboratorsCount} collaborators
            </span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCustomizeOpen((open) => !open)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-full text-xs font-medium border border-white/5 transition"
            >
              <Palette className="h-3.5 w-3.5" />
              <span>Customize</span>
            </button>

            {isCustomizeOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-white/10 bg-[#25272a] p-4 text-left shadow-2xl shadow-black/40">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Accent color
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {(Object.keys(accentStyles) as DashboardAccent[]).map((key) => {
                      const item = accentStyles[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setDashboardAccent(key)}
                          className={`flex h-10 items-center justify-center rounded-lg border transition ${
                            dashboardAccent === key
                              ? 'border-white/40 bg-white/10'
                              : 'border-white/10 bg-white/[0.03] hover:bg-white/10'
                          }`}
                          title={item.label}
                        >
                          <span className={`h-4 w-4 rounded-full ${item.swatch}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Density
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(['comfortable', 'compact'] as DashboardDensity[]).map((density) => (
                      <button
                        key={density}
                        type="button"
                        onClick={() => setDashboardDensity(density)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition ${
                          dashboardDensity === density
                            ? `${accent.bg} ${accent.border} ${accent.text}`
                            : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/10'
                        }`}
                      >
                        {density}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: My Tasks */}
        <div
          className={`bg-[#25272a] border border-[#323438] rounded-2xl shadow-xl overflow-hidden flex flex-col ${panelPadding} ${panelMinHeight}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Pink/Pastel avatar with initials */}
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${accent.solid} text-white text-xs font-bold font-mono shadow-inner shadow-black/10 select-none`}
              >
                {getInitials()}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-lg text-white">My tasks</span>
                <Lock className="h-4 w-4 text-zinc-400" />
              </div>
            </div>
            <button className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#323438] gap-4 mb-4 text-sm">
            {(['upcoming', 'overdue', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTaskTab(tab)}
                className={`pb-2.5 font-medium transition capitalize relative ${
                  taskTab === tab ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab}
                {taskTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Create Task Button */}
          {canCreateTasks && (
            <button
              onClick={() => setIsCreateTaskOpen(true)}
              className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 text-sm mb-4 transition w-fit py-1.5 px-2.5 hover:bg-white/5 border border-zinc-700/50 rounded-lg -ml-1"
            >
              <Plus className="h-4 w-4" />
              <span>Create task</span>
            </button>
          )}

          {/* Task List */}
          <div className="flex-1 flex flex-col divide-y divide-[#323438]/50">
            {filteredTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-12 text-sm italic">
                No tasks in this section
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="py-3 flex items-center justify-between gap-3 text-sm group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Circle Checkbox Button */}
                    <button
                      onClick={() => toggleTaskCompletion(task)}
                      className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-all transform hover:scale-105 duration-100 ${
                        task.status === 'COMPLETED'
                          ? `${accent.border} ${accent.bg} ${accent.text}`
                          : 'border-zinc-500 hover:border-zinc-300 text-transparent hover:text-zinc-400'
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </button>

                    {/* Task Title */}
                    <span
                      onClick={() => navigate('/tasks')}
                      className={`truncate cursor-pointer hover:underline ${
                        task.status === 'COMPLETED' ? 'line-through text-zinc-500' : 'text-zinc-200'
                      }`}
                    >
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Project badge */}
                    {task.project && (
                      <span
                        className={`${accent.bg} ${accent.text} border ${accent.border} px-2 py-0.5 text-[10px] rounded-md font-medium max-w-[100px] truncate`}
                      >
                        {task.project.projectName}
                      </span>
                    )}

                    {/* Due Date */}
                    {task.dueDate && (
                      <span className="text-xs text-zinc-400 font-medium">
                        {formatTaskDate(task.startDate, task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Projects */}
        <div
          className={`bg-[#25272a] border border-[#323438] rounded-2xl shadow-xl overflow-hidden flex flex-col ${panelPadding} ${panelMinHeight}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg text-white">Projects</span>
              <button className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 font-medium px-2 py-1 bg-white/5 rounded-md transition">
                <span>Recents</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <button className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Create Project Card */}
            <button
              onClick={() => setIsCreateProjectOpen(true)}
              className={`flex flex-col items-center justify-center ${dashboardDensity === 'compact' ? 'p-4' : 'p-6'} bg-transparent hover:bg-white/5 border border-dashed border-[#323438] hover:border-zinc-500 rounded-xl ${projectCardMinHeight} text-zinc-400 hover:text-zinc-200 transition group`}
            >
              <div className="h-10 w-10 flex items-center justify-center rounded-full border border-dashed border-[#323438] group-hover:border-zinc-500 mb-3 transition">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold">Create project</span>
            </button>

            {/* Existing Projects */}
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className={`flex items-center gap-4 ${dashboardDensity === 'compact' ? 'p-4' : 'p-5'} bg-white/[0.02] hover:bg-white/[0.06] border border-[#323438] rounded-xl cursor-pointer transition ${projectCardMinHeight}`}
              >
                {/* Blue icon with concentric circles */}
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent.solid} text-white shadow-md ${accent.shadow}`}
                >
                  <div className="h-6 w-6 rounded-full border-[2.5px] border-white flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-white truncate text-sm" title={p.projectName}>
                    {p.projectName}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 font-medium">{getTasksDueSoon(p.id)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals integration */}
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
