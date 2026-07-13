import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import type { TimeLog, Project, Task, AuthUser } from '@clientflow/types';
import {
  Play,
  Square,
  Clock,
  Plus,
  Check,
  X,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  Pause,
  Award,
  Users,
  Search,
  Filter,
  RefreshCw,
  FolderKanban,
  FileText,
  BarChart3,
  Download,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit2,
  CheckSquare,
  Square as SquareIcon,
} from 'lucide-react';

type TabId = 'overview' | 'live' | 'timesheets' | 'approvals' | 'analytics';

export function TimesheetWorkspacePage() {
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [usersList, setUsersList] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Stopwatch panel state
  const [activeTimer, setActiveTimer] = useState<TimeLog | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerDescription, setTimerDescription] = useState('');
  const [timerProjectId, setTimerProjectId] = useState('');
  const [timerTaskId, setTimerTaskId] = useState('');
  const [timerBillable, setTimerBillable] = useState(true);
  const [timerIsPaused, setTimerIsPaused] = useState(false);
  const timerIntervalRef = useRef<number | null>(null);

  // Collapsible state for Timesheets groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Bulk actions in approvals
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<Record<string, boolean>>({});

  // Manual entry modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    projectId: '',
    taskId: '',
    description: '',
    startTime: '',
    endTime: '',
    billable: true,
  });

  // Edit entry modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLog, setEditingLog] = useState<TimeLog | null>(null);
  const [editForm, setEditForm] = useState({
    projectId: '',
    taskId: '',
    description: '',
    startTime: '',
    endTime: '',
    billable: true,
    status: 'DRAFT',
  });

  // Filters State
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    staffId: 'ALL',
    projectId: 'ALL',
    clientId: 'ALL',
    taskId: 'ALL',
    billable: 'ALL',
    status: 'ALL',
    search: '',
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const isAdmin = user?.role === 'ADMIN';

  // Retrieve cached filters on mount
  useEffect(() => {
    const cached = localStorage.getItem('time-tracking-filters');
    if (cached) {
      try {
        setFilters((prev) => ({ ...prev, ...JSON.parse(cached) }));
      } catch (e) {
        console.error('Failed to parse cached filters', e);
      }
    }
  }, []);

  // Save filters to cache
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    localStorage.setItem('time-tracking-filters', JSON.stringify(next));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    const defaultFilters = {
      startDate: '',
      endDate: '',
      staffId: 'ALL',
      projectId: 'ALL',
      clientId: 'ALL',
      taskId: 'ALL',
      billable: 'ALL',
      status: 'ALL',
      search: '',
    };
    setFilters(defaultFilters);
    localStorage.setItem('time-tracking-filters', JSON.stringify(defaultFilters));
    setCurrentPage(1);
  };

  const loadFilterOptions = async () => {
    try {
      const [prjRes, tskRes, usrRes] = await Promise.all([
        api.get('/projects?limit=1000'),
        api.get('/tasks'),
        api.get('/users').catch(() => ({ data: { data: { users: [] } } })),
      ]);
      const prjs = prjRes.data.data?.items ?? [];
      setProjects(prjs);
      setTasks(tskRes.data.data ?? []);
      setUsersList(usrRes.data.data?.users ?? []);

      if (prjs.length > 0) {
        setTimerProjectId(prjs[0].id);
        setManualForm((f) => ({ ...f, projectId: prjs[0].id }));
      }
    } catch (err) {
      console.error('Failed to load filters metadata', err);
    }
  };

  const loadTimeLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/timelogs');
      setLogs(res.data.data ?? []);
    } catch (err) {
      notify({ type: 'error', title: 'Load Failed', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  // Stopwatch loading & sync
  const loadActiveTimer = async () => {
    try {
      const res = await api.get('/timer/active');
      const active = res.data.data;

      // Sync with localStorage pause cache
      const cachedPauseStr = localStorage.getItem('clientflow-paused-timer');
      const cachedPause = cachedPauseStr ? JSON.parse(cachedPauseStr) : null;

      if (active) {
        setActiveTimer(active);
        setTimerDescription(active.description);
        setTimerProjectId(active.projectId);
        setTimerTaskId(active.taskId || '');
        setTimerBillable(active.billable);
        setTimerIsPaused(false);

        // Check if there are saved accumulated seconds in localStorage for this timer
        const localOffset = Number(localStorage.getItem(`timer-offset-${active.id}`)) || 0;
        const start = new Date(active.startTime).getTime();
        const diffSecs = Math.floor((Date.now() - start) / 1000);
        setTimerSeconds(localOffset + diffSecs);

        startStopwatchInterval();
      } else if (cachedPause && cachedPause.userId === user?.id) {
        // Recover paused state
        setTimerIsPaused(true);
        setTimerSeconds(cachedPause.seconds);
        setTimerDescription(cachedPause.description);
        setTimerProjectId(cachedPause.projectId);
        setTimerTaskId(cachedPause.taskId);
        setTimerBillable(cachedPause.billable);
      } else {
        setActiveTimer(null);
        setTimerSeconds(0);
        setTimerIsPaused(false);
        stopStopwatchInterval();
      }
    } catch (err) {
      console.error('Failed to retrieve active stopwatch', err);
    }
  };

  useEffect(() => {
    loadFilterOptions();
    loadTimeLogs();
    loadActiveTimer();

    return () => {
      stopStopwatchInterval();
    };
  }, []);

  const startStopwatchInterval = () => {
    if (timerIntervalRef.current) return;
    timerIntervalRef.current = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev === 28800) {
          notify({
            type: 'error',
            title: 'Timer Warning',
            message: "Your active stopwatch has reached 8 hours. Don't forget to stop it!",
          });
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopStopwatchInterval = () => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Stopwatch actions
  const handleStartTimer = async () => {
    if (!timerProjectId) {
      notify({ type: 'error', title: 'Start Failed', message: 'Please select a project.' });
      return;
    }
    if (!timerDescription.trim()) {
      notify({
        type: 'error',
        title: 'Start Failed',
        message: 'Please enter what you are working on.',
      });
      return;
    }

    try {
      // Clear localStorage offset for fresh timer
      localStorage.removeItem('timer-accumulated-offset');

      const res = await api.post('/timer/start', {
        projectId: timerProjectId,
        taskId: timerTaskId || null,
        description: timerDescription,
      });

      const timer = res.data.data;
      // If we are resuming a paused timer, carry forward the seconds
      if (timerIsPaused) {
        localStorage.setItem(`timer-offset-${timer.id}`, String(timerSeconds));
        setTimerIsPaused(false);
      } else {
        setTimerSeconds(0);
      }

      localStorage.removeItem('clientflow-paused-timer');
      setActiveTimer(timer);
      startStopwatchInterval();
      notify({ type: 'success', title: 'Timer started' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Action Failed', message: errorMessage(err) });
    }
  };

  const handlePauseTimer = async () => {
    if (!activeTimer) return;
    try {
      stopStopwatchInterval();
      // Stop the timer in the backend to record the current segment
      await api.post('/timer/stop');

      const totalAccumulated = timerSeconds;

      // Cache paused details in localStorage
      localStorage.setItem(
        'clientflow-paused-timer',
        JSON.stringify({
          userId: user?.id,
          seconds: totalAccumulated,
          description: timerDescription,
          projectId: timerProjectId,
          taskId: timerTaskId,
          billable: timerBillable,
        }),
      );

      setTimerIsPaused(true);
      setActiveTimer(null);
      notify({ type: 'success', title: 'Timer paused' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Pause Failed', message: errorMessage(err) });
      startStopwatchInterval();
    }
  };

  const handleStopTimer = async () => {
    try {
      stopStopwatchInterval();
      if (activeTimer) {
        await api.post('/timer/stop');
      }

      // Clear timer offsets
      if (activeTimer) {
        localStorage.removeItem(`timer-offset-${activeTimer.id}`);
      }
      localStorage.removeItem('clientflow-paused-timer');

      setActiveTimer(null);
      setTimerSeconds(0);
      setTimerDescription('');
      setTimerIsPaused(false);
      notify({ type: 'success', title: 'Time logged successfully' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Stop Failed', message: errorMessage(err) });
      if (activeTimer) startStopwatchInterval();
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.projectId || !manualForm.description.trim()) return;

    try {
      await api.post('/timelogs', manualForm);
      notify({ type: 'success', title: 'Time Entry Logged' });
      setShowManualModal(false);
      setManualForm({
        projectId: projects[0]?.id || '',
        taskId: '',
        description: '',
        startTime: '',
        endTime: '',
        billable: true,
      });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Failed to add manual log', message: errorMessage(err) });
    }
  };

  // Submit timesheet log
  const handleSubmitLog = async (id: string) => {
    try {
      await api.post(`/timelogs/${id}/submit`);
      notify({ type: 'success', title: 'Time entry submitted for review' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Submission Failed', message: errorMessage(err) });
    }
  };

  // Approve / Reject individual log
  const handleApprove = async (id: string) => {
    try {
      await api.post(`/timelogs/${id}/approve`);
      notify({ type: 'success', title: 'Approved time log' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Approval Failed', message: errorMessage(err) });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.post(`/timelogs/${id}/reject`);
      notify({ type: 'success', title: 'Time entry rejected' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Rejection Failed', message: errorMessage(err) });
    }
  };

  // Bulk actions
  const handleBulkApprove = async () => {
    const ids = Object.keys(selectedApprovalIds).filter((id) => selectedApprovalIds[id]);
    if (ids.length === 0) return;
    try {
      await api.post('/timelogs/bulk-approve', { ids });
      notify({ type: 'success', title: `Approved ${ids.length} entries successfully` });
      setSelectedApprovalIds({});
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Bulk Approval Failed', message: errorMessage(err) });
    }
  };

  const handleBulkReject = async () => {
    const ids = Object.keys(selectedApprovalIds).filter((id) => selectedApprovalIds[id]);
    if (ids.length === 0) return;
    try {
      await api.post('/timelogs/bulk-reject', { ids });
      notify({ type: 'success', title: `Rejected ${ids.length} entries` });
      setSelectedApprovalIds({});
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Bulk Rejection Failed', message: errorMessage(err) });
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this log?')) return;
    try {
      await api.delete(`/timelogs/${id}`);
      notify({ type: 'success', title: 'Time entry deleted' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Deletion Failed', message: errorMessage(err) });
    }
  };

  // Edit Time Log Modal Actions
  const openEditLog = (log: TimeLog) => {
    setEditingLog(log);
    const formatDateTimeLocal = (dateStr: string | Date | null | undefined) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      // local ISO format YYYY-MM-DDTHH:MM
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - offset * 60 * 1000);
      return local.toISOString().slice(0, 16);
    };

    setEditForm({
      projectId: log.projectId,
      taskId: log.taskId || '',
      description: log.description,
      startTime: formatDateTimeLocal(log.startTime),
      endTime: formatDateTimeLocal(log.endTime),
      billable: log.billable,
      status: log.status,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    try {
      await api.patch(`/timelogs/${editingLog.id}`, {
        projectId: editForm.projectId,
        taskId: editForm.taskId || null,
        description: editForm.description,
        startTime: editForm.startTime ? new Date(editForm.startTime).toISOString() : undefined,
        endTime: editForm.endTime ? new Date(editForm.endTime).toISOString() : null,
        billable: editForm.billable,
        status: editForm.status,
      });
      notify({ type: 'success', title: 'Time Entry Updated' });
      setShowEditModal(false);
      setEditingLog(null);
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Failed to update entry', message: errorMessage(err) });
    }
  };

  // Formatter seconds -> HH:MM:SS
  const formatStopwatch = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0'),
    ].join(':');
  };

  // Data processing for filters and groups
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search term (description matching)
      if (filters.search && !log.description.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      // Project filter
      if (filters.projectId !== 'ALL' && log.projectId !== filters.projectId) {
        return false;
      }
      // Client filter
      if (filters.clientId !== 'ALL' && log.project?.clientId !== filters.clientId) {
        return false;
      }
      // Staff filter
      if (filters.staffId !== 'ALL' && log.userId !== filters.staffId) {
        return false;
      }
      // Task filter
      if (filters.taskId !== 'ALL' && log.taskId !== filters.taskId) {
        return false;
      }
      // Billable filter
      if (filters.billable !== 'ALL') {
        const isBillable = filters.billable === 'BILLABLE';
        if (log.billable !== isBillable) return false;
      }
      // Status filter
      if (filters.status !== 'ALL') {
        if (filters.status === 'RUNNING' && log.endTime !== null) return false;
        if (filters.status !== 'RUNNING' && (log.status !== filters.status || log.endTime === null))
          return false;
      }
      // Dates
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        if (new Date(log.startTime) < start) return false;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(log.startTime) > end) return false;
      }
      return true;
    });
  }, [logs, filters]);

  // Collapsible list groups
  const groupedTimesheets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const groups: {
      today: { label: string; items: TimeLog[]; totalHours: number };
      yesterday: { label: string; items: TimeLog[]; totalHours: number };
      thisWeek: { label: string; items: TimeLog[]; totalHours: number };
      older: { label: string; items: TimeLog[]; totalHours: number };
    } = {
      today: { label: 'Today', items: [], totalHours: 0 },
      yesterday: { label: 'Yesterday', items: [], totalHours: 0 },
      thisWeek: { label: 'This Week', items: [], totalHours: 0 },
      older: { label: 'Older', items: [], totalHours: 0 },
    };

    filteredLogs.forEach((log) => {
      const logDate = new Date(log.startTime);
      logDate.setHours(0, 0, 0, 0);

      const hours = Number(log.duration || 0);

      if (logDate.getTime() === today.getTime()) {
        groups.today.items.push(log);
        groups.today.totalHours += hours;
      } else if (logDate.getTime() === yesterday.getTime()) {
        groups.yesterday.items.push(log);
        groups.yesterday.totalHours += hours;
      } else if (logDate.getTime() >= startOfWeek.getTime()) {
        groups.thisWeek.items.push(log);
        groups.thisWeek.totalHours += hours;
      } else {
        groups.older.items.push(log);
        groups.older.totalHours += hours;
      }
    });

    // Round hours
    groups.today.totalHours = Math.round(groups.today.totalHours * 100) / 100;
    groups.yesterday.totalHours = Math.round(groups.yesterday.totalHours * 100) / 100;
    groups.thisWeek.totalHours = Math.round(groups.thisWeek.totalHours * 100) / 100;
    groups.older.totalHours = Math.round(groups.older.totalHours * 100) / 100;

    return groups;
  }, [filteredLogs]);

  // Approvals list (SUBMITTED status logs only)
  const approvalLogs = useMemo(() => {
    return logs.filter((log) => log.status === 'SUBMITTED' && log.endTime !== null);
  }, [logs]);

  // Running active timers list
  const activeTimersList = useMemo(() => {
    return logs.filter((log) => log.endTime === null);
  }, [logs]);

  // Clients list extracted from projects
  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => {
      if (p.client) {
        map.set(p.client.id, p.client.companyName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [projects]);

  // Metrics summary
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    let todayHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;
    let weeklyHours = 0;
    let estimatedRevenue = 0;

    logs.forEach((log) => {
      const date = new Date(log.startTime);
      date.setHours(0, 0, 0, 0);
      const hours = Number(log.duration || 0);

      // Today
      if (date.getTime() === today.getTime()) {
        todayHours += hours;
      }

      // Weekly
      if (date.getTime() >= startOfWeek.getTime()) {
        weeklyHours += hours;
      }

      // Billable vs Non-Billable
      if (log.billable) {
        billableHours += hours;
        estimatedRevenue += hours * (log.hourlyRateSnapshot || log.user?.hourlyRate || 0);
      } else {
        nonBillableHours += hours;
      }
    });

    const totalHours = billableHours + nonBillableHours;
    const utilization = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;

    return {
      todayHours: Math.round(todayHours * 100) / 100,
      billableHours: Math.round(billableHours * 100) / 100,
      nonBillableHours: Math.round(nonBillableHours * 100) / 100,
      weeklyHours: Math.round(weeklyHours * 100) / 100,
      estimatedRevenue: Math.round(estimatedRevenue * 100) / 100,
      utilization,
    };
  }, [logs]);

  // Analytics charts helpers
  const chartsData = useMemo(() => {
    // 1. Projects Breakdown
    const projMap: Record<string, number> = {};
    // 2. Staff Breakdown
    const devMap: Record<string, number> = {};
    // 3. Weekly hours trend (last 7 days)
    const trendMap: Record<string, number> = {};

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      trendMap[d.toLocaleDateString(undefined, { weekday: 'short' })] = 0;
    }

    logs.forEach((log) => {
      if (log.endTime === null) return;
      const hours = Number(log.duration || 0);

      // Projects
      const pName = log.project?.projectName || 'No Project';
      projMap[pName] = (projMap[pName] || 0) + hours;

      // Staff members
      const devName = log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Unassigned';
      devMap[devName] = (devMap[devName] || 0) + hours;

      // Trend
      const dayName = new Date(log.startTime).toLocaleDateString(undefined, { weekday: 'short' });
      if (dayName in trendMap) {
        trendMap[dayName] = (trendMap[dayName] || 0) + hours;
      }
    });

    const projectData = Object.entries(projMap).map(([name, hours]) => ({
      name,
      hours: Math.round(hours * 10) / 10,
    }));
    const staffData = Object.entries(devMap).map(([name, hours]) => ({
      name,
      hours: Math.round(hours * 10) / 10,
    }));
    const trendData = Object.entries(trendMap).map(([name, hours]) => ({
      name,
      hours: Math.round(hours * 10) / 10,
    }));

    return { projectData, staffData, trendData };
  }, [logs]);

  // CSV Export Trigger
  const exportToCSV = () => {
    const headers = [
      'Date',
      'Staff Member',
      'Project',
      'Task',
      'Description',
      'Hours',
      'Billable',
      'Value ($)',
      'Status',
    ];
    const rows = filteredLogs.map((log) => [
      new Date(log.startTime).toLocaleDateString(),
      log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Unknown',
      log.project?.projectName || 'N/A',
      log.task?.title || 'None',
      log.description.replace(/"/g, '""'),
      log.duration,
      log.billable ? 'Yes' : 'No',
      log.billable
        ? (log.duration * (log.hourlyRateSnapshot || log.user?.hourlyRate || 0)).toFixed(2)
        : '0.00',
      log.status,
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((e) => e.map((val) => `"${val}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `time_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify({ type: 'success', title: 'Export Finished', message: 'CSV file downloaded.' });
  };

  // Render variables
  const projectTasks = tasks.filter((t) => t.projectId === timerProjectId);

  return (
    <div className="grid gap-6">
      {/* Title Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
            Time Tracking Workspace
          </h1>
          <p className="text-xs text-foreground/50 mt-1 font-medium">
            Manage stopwatch sessions, approve employee sheets, and audit billable client analytics.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs font-bold shadow-md shadow-primary/10"
          >
            <Plus className="h-4 w-4" /> Add Manual Entry
          </Button>
        </div>
      </div>

      {/* stopwatch widget at the top */}
      <Card className="border border-border bg-gradient-to-br from-primary/5 via-indigo-500/5 to-card p-5 rounded-2xl relative overflow-hidden shadow-sm">
        <div className="flex flex-col lg:flex-row gap-5 items-center justify-between z-10 relative">
          <div className="flex items-center gap-4 shrink-0 w-full lg:w-auto">
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center border shadow-inner transition-colors duration-500 ${activeTimer ? 'bg-danger/10 text-danger border-danger/20 animate-pulse' : 'bg-primary/10 text-primary border-primary/20'}`}
            >
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 flex items-center gap-1">
                {activeTimer && (
                  <span className="h-1.5 w-1.5 rounded-full bg-danger animate-ping" />
                )}
                {activeTimer
                  ? 'Stopwatch active'
                  : timerIsPaused
                    ? 'Stopwatch paused'
                    : 'Stopwatch idle'}
              </span>
              <span className="block font-mono text-3xl font-black text-foreground mt-0.5 tracking-wider">
                {formatStopwatch(timerSeconds)}
              </span>
            </div>
          </div>

          {/* stopwatch configuration panel */}
          <div className="grid gap-3 sm:grid-cols-3 flex-1 w-full text-xs">
            <div className="relative">
              <input
                type="text"
                placeholder="What are you working on?..."
                value={timerDescription}
                onChange={(e) => setTimerDescription(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                disabled={!!activeTimer}
              />
            </div>

            <select
              value={timerProjectId}
              onChange={(e) => setTimerProjectId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold cursor-pointer"
              disabled={!!activeTimer}
            >
              <option value="">Choose Project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName}
                </option>
              ))}
            </select>

            <select
              value={timerTaskId}
              onChange={(e) => setTimerTaskId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold cursor-pointer"
              disabled={!!activeTimer}
            >
              <option value="">Link Task (Optional)...</option>
              {projectTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="shrink-0 w-full lg:w-auto flex justify-end gap-2.5">
            {activeTimer ? (
              <>
                <Button
                  onClick={handlePauseTimer}
                  className="w-full lg:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 h-10 px-4"
                >
                  <Pause className="h-4.5 w-4.5" /> Pause
                </Button>
                <Button
                  onClick={handleStopTimer}
                  className="w-full lg:w-auto bg-danger hover:bg-danger/90 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 h-10 px-4"
                >
                  <Square className="h-4.5 w-4.5" /> Stop & Log
                </Button>
              </>
            ) : (
              <>
                {timerIsPaused && (
                  <Button
                    onClick={handleStopTimer}
                    variant="ghost"
                    className="h-10 rounded-xl px-4 font-bold border border-border hover:bg-muted text-foreground"
                  >
                    Reset
                  </Button>
                )}
                <Button
                  onClick={handleStartTimer}
                  className="w-full lg:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 h-10 px-5"
                >
                  <Play className="h-4.5 w-4.5" /> {timerIsPaused ? 'Resume' : 'Start Timer'}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Internal Navigation Tabs */}
      <div className="flex border-b border-border/80 overflow-x-auto text-xs font-bold uppercase tracking-wider text-foreground/50 select-none pb-px">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'live', label: `Live Timers (${activeTimersList.length})`, icon: Clock },
          { id: 'timesheets', label: 'Timesheets History', icon: FileText },
          isAdmin && { id: 'approvals', label: `Approvals (${approvalLogs.length})`, icon: Award },
          { id: 'analytics', label: 'Analytics Reports', icon: TrendingUp },
        ]
          .filter(Boolean)
          .map((tab: any) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 transition whitespace-nowrap -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-black'
                  : 'border-transparent hover:text-foreground hover:border-border'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
      </div>

      <div className="grid gap-6">
        {/* ===================== OVERVIEW TAB ===================== */}
        {activeTab === 'overview' && (
          <div className="grid gap-6">
            {/* Widget Cards Grid */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card className="p-4 flex flex-col justify-between border border-border hover:border-primary/10 transition shadow-xs h-28 bg-card">
                <div className="flex justify-between items-start text-foreground/55">
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Today's Hours
                  </span>
                  <Clock className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="mt-2">
                  <span className="block text-2xl font-black text-foreground">
                    {metrics.todayHours} hrs
                  </span>
                  <span className="text-[10px] text-foreground/40 font-medium">
                    Logged by you today
                  </span>
                </div>
              </Card>

              <Card className="p-4 flex flex-col justify-between border border-border hover:border-primary/10 transition shadow-xs h-28 bg-card">
                <div className="flex justify-between items-start text-foreground/55">
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Billable Hours
                  </span>
                  <DollarSign className="h-4.5 w-4.5 text-emerald-500" />
                </div>
                <div className="mt-2">
                  <span className="block text-2xl font-black text-emerald-600">
                    {metrics.billableHours} hrs
                  </span>
                  <span className="text-[10px] text-foreground/40 font-medium">
                    {metrics.utilization}% Utilization rate
                  </span>
                </div>
              </Card>

              <Card className="p-4 flex flex-col justify-between border border-border hover:border-primary/10 transition shadow-xs h-28 bg-card">
                <div className="flex justify-between items-start text-foreground/55">
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Pending Approvals
                  </span>
                  <Award className="h-4.5 w-4.5 text-amber-500" />
                </div>
                <div className="mt-2">
                  <span className="block text-2xl font-black text-foreground">
                    {approvalLogs.length} entries
                  </span>
                  <span className="text-[10px] text-foreground/40 font-medium">
                    Submitted time logs
                  </span>
                </div>
              </Card>

              <Card className="p-4 flex flex-col justify-between border border-border hover:border-primary/10 transition shadow-xs h-28 bg-card">
                <div className="flex justify-between items-start text-foreground/55">
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Estimated Value
                  </span>
                  <TrendingUp className="h-4.5 w-4.5 text-indigo-500" />
                </div>
                <div className="mt-2">
                  <span className="block text-2xl font-black text-foreground">
                    ${metrics.estimatedRevenue.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-foreground/40 font-medium">
                    This week's billable amount
                  </span>
                </div>
              </Card>
            </div>

            {/* Custom Responsive SVG Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-5 flex flex-col gap-4 border border-border bg-card">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" /> Weekly Trend (Logged Hours)
                </h3>
                <div className="relative h-44 w-full flex items-end justify-between px-2 pt-6">
                  {chartsData.trendData.map((d) => (
                    <div
                      key={d.name}
                      className="flex flex-col items-center flex-1 gap-2 group relative"
                    >
                      {/* Tooltip */}
                      <span className="absolute -top-6 bg-foreground text-background text-[9px] font-bold py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition duration-150 whitespace-nowrap shadow z-20">
                        {d.hours} hrs
                      </span>
                      {/* Bar */}
                      <div
                        className="w-8 rounded-t bg-gradient-to-t from-primary/80 to-primary group-hover:from-primary group-hover:to-indigo-500 transition-all duration-300"
                        style={{ height: `${Math.max(4, Math.min(d.hours * 10, 120))}px` }}
                      />
                      <span className="text-[9px] font-bold text-foreground/50">{d.name}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5 flex flex-col gap-4 border border-border bg-card">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <FolderKanban className="h-4 w-4 text-primary" /> Project Distribution
                </h3>
                <div className="space-y-3.5 text-xs font-semibold py-2">
                  {chartsData.projectData.slice(0, 4).map((item) => {
                    const pct =
                      metrics.billableHours + metrics.nonBillableHours > 0
                        ? Math.round(
                            (item.hours / (metrics.billableHours + metrics.nonBillableHours)) * 100,
                          )
                        : 0;
                    return (
                      <div key={item.name}>
                        <div className="flex justify-between mb-1">
                          <span className="truncate max-w-[200px]">{item.name}</span>
                          <span className="text-foreground/50">
                            {item.hours}h ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {chartsData.projectData.length === 0 && (
                    <div className="py-12 text-center text-foreground/45 italic">
                      No logged data available for projects.
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Recent Activity List */}
            <Card className="p-0 overflow-hidden border border-border bg-card">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-bold">Recent Time Tracking Activity</h3>
              </div>
              <div className="divide-y divide-border/60 text-xs font-semibold">
                {logs.slice(0, 5).map((log) => {
                  return (
                    <div
                      key={log.id}
                      className="px-5 py-3.5 flex flex-wrap justify-between items-center gap-3 hover:bg-muted/10 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {log.user?.firstName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">
                            {log.user?.firstName} {log.user?.lastName}
                          </p>
                          <span className="text-[10px] text-foreground/50">
                            {log.description} • {log.project?.projectName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-primary">{log.duration} hrs</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-black border ${log.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : log.status === 'SUBMITTED' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}
                        >
                          {log.endTime === null ? 'RUNNING' : log.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {logs.length === 0 && (
                  <div className="p-8 text-center text-foreground/45 italic">
                    No recent activity found.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ===================== LIVE TIMERS TAB ===================== */}
        {activeTab === 'live' && (
          <Card className="p-0 overflow-hidden border border-border bg-card">
            <div className="px-5 py-4 border-b border-border flex justify-between items-center">
              <h3 className="text-sm font-bold">All Active Timers</h3>
              <span className="text-xs text-foreground/45 font-bold">
                Showing {activeTimersList.length} running stopwatch sessions
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-foreground/50 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3">Staff Member</th>
                    <th className="px-5 py-3">Project</th>
                    <th className="px-5 py-3">Task</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Started At</th>
                    <th className="px-5 py-3">Billable</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {activeTimersList.map((log) => {
                    return (
                      <tr key={log.id} className="hover:bg-muted/5 transition duration-150">
                        <td className="px-5 py-3.5 flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {log.user?.firstName?.charAt(0)}
                          </div>
                          <span>
                            {log.user?.firstName} {log.user?.lastName}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold">{log.project?.projectName}</td>
                        <td className="px-5 py-3.5 text-foreground/50">
                          {log.task?.title || 'None Linked'}
                        </td>
                        <td className="px-5 py-3.5 text-foreground/80">{log.description}</td>
                        <td className="px-5 py-3.5 text-foreground/50">
                          {new Date(log.startTime).toLocaleTimeString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black ${log.billable ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'}`}
                          >
                            {log.billable ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            variant="danger"
                            onClick={async () => {
                              try {
                                await api.patch(`/timelogs/${log.id}`, {
                                  endTime: new Date().toISOString(),
                                });
                                notify({
                                  type: 'success',
                                  title: 'Timer Stopped',
                                  message: `Stopped timer for ${log.user?.firstName}.`,
                                });
                                loadTimeLogs();
                              } catch (err) {
                                notify({
                                  type: 'error',
                                  title: 'Action Failed',
                                  message: errorMessage(err),
                                });
                              }
                            }}
                            className="h-7 px-2 text-[10px]"
                          >
                            Stop
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {activeTimersList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-foreground/45 italic">
                        No Staff members are currently tracking time.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ===================== TIMESHEETS TAB ===================== */}
        {activeTab === 'timesheets' && (
          <div className="grid gap-6">
            {/* Filters Widget Panel */}
            <Card className="p-5 grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 text-xs font-semibold border border-border bg-card">
              <div className="grid gap-1">
                <label className="text-foreground/50">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="h-9 rounded-xl border border-border bg-background px-3 outline-none font-semibold text-foreground focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-foreground/50">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="h-9 rounded-xl border border-border bg-background px-3 outline-none font-semibold text-foreground focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {isAdmin && (
                <div className="grid gap-1">
                  <label className="text-foreground/50">Team Member</label>
                  <select
                    value={filters.staffId}
                    onChange={(e) => handleFilterChange('staffId', e.target.value)}
                    className="h-9 rounded-xl border border-border bg-background px-2 outline-none font-semibold cursor-pointer"
                  >
                    <option value="ALL">All Members</option>
                    {usersList
                      .filter((u) => u.role !== 'CLIENT')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid gap-1">
                <label className="text-foreground/50">Project</label>
                <select
                  value={filters.projectId}
                  onChange={(e) => handleFilterChange('projectId', e.target.value)}
                  className="h-9 rounded-xl border border-border bg-background px-2 outline-none font-semibold cursor-pointer"
                >
                  <option value="ALL">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-foreground/50">Client</label>
                <select
                  value={filters.clientId}
                  onChange={(e) => handleFilterChange('clientId', e.target.value)}
                  className="h-9 rounded-xl border border-border bg-background px-2 outline-none font-semibold cursor-pointer"
                >
                  <option value="ALL">All Clients</option>
                  {uniqueClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-foreground/50">Billable</label>
                <select
                  value={filters.billable}
                  onChange={(e) => handleFilterChange('billable', e.target.value)}
                  className="h-9 rounded-xl border border-border bg-background px-2 outline-none font-semibold cursor-pointer"
                >
                  <option value="ALL">All Hours</option>
                  <option value="BILLABLE">Billable Only</option>
                  <option value="NON_BILLABLE">Non-Billable Only</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-foreground/50">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="h-9 rounded-xl border border-border bg-background px-2 outline-none font-semibold cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="RUNNING">Running</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div className="grid gap-1 sm:col-span-2">
                <label className="text-foreground/50">Search Keywords</label>
                <div className="relative">
                  <Search className="h-4 w-4 text-foreground/45 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search logs description..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 outline-none font-semibold text-foreground focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2 items-end pt-1">
                <Button
                  variant="ghost"
                  onClick={handleResetFilters}
                  className="h-9 w-full rounded-xl font-bold border border-border text-foreground"
                >
                  Clear
                </Button>
                <Button
                  onClick={exportToCSV}
                  className="h-9 w-full rounded-xl font-bold bg-indigo-600 text-white flex items-center justify-center gap-1.5"
                >
                  <FileSpreadsheet className="h-4 w-4" /> Export CSV
                </Button>
              </div>
            </Card>

            {/* collapsible grouped table logs */}
            <div className="space-y-4">
              {Object.entries(groupedTimesheets).map(([key, group]) => {
                if (group.items.length === 0) return null;
                const isCollapsed = collapsedGroups[key];

                return (
                  <Card key={key} className="p-0 overflow-hidden border border-border bg-card">
                    {/* Group Header */}
                    <div
                      onClick={() => setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className="px-5 py-4 border-b border-border bg-muted/20 flex justify-between items-center cursor-pointer select-none hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? (
                          <ChevronDown className="h-4 w-4 text-foreground/50" />
                        ) : (
                          <ChevronUp className="h-4 w-4 text-foreground/50" />
                        )}
                        <h4 className="text-sm font-extrabold text-foreground">{group.label}</h4>
                        <span className="text-[10px] font-bold text-foreground/45 bg-muted px-2 py-0.5 rounded-full">
                          {group.items.length} logs
                        </span>
                      </div>
                      <span className="text-xs font-black text-primary">
                        {group.totalHours} hrs logged
                      </span>
                    </div>

                    {/* Group List content */}
                    {!isCollapsed && (
                      <div className="overflow-x-auto text-xs font-semibold">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-border bg-muted/10 text-foreground/50 font-bold uppercase tracking-wider text-[10px]">
                              {isAdmin && <th className="px-5 py-3">Member</th>}
                              <th className="px-5 py-3">Description</th>
                              <th className="px-5 py-3">Project / Task</th>
                              <th className="px-5 py-3">Hours</th>
                              <th className="px-5 py-3">Value</th>
                              <th className="px-5 py-3">Status</th>
                              <th className="px-5 py-3">Date</th>
                              <th className="px-5 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {group.items.map((log) => {
                              const hourlyRate =
                                log.hourlyRateSnapshot || log.user?.hourlyRate || 0;
                              const value = log.duration * hourlyRate;
                              return (
                                <tr
                                  key={log.id}
                                  className="hover:bg-muted/5 transition duration-150"
                                >
                                  {isAdmin && (
                                    <td className="px-5 py-3.5 font-bold">
                                      {log.user
                                        ? `${log.user.firstName} ${log.user.lastName}`
                                        : 'N/A'}
                                    </td>
                                  )}
                                  <td className="px-5 py-3.5 max-w-sm truncate text-foreground/90">
                                    {log.description}
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <span className="block font-bold">
                                      {log.project?.projectName}
                                    </span>
                                    <span className="text-[10px] text-foreground/45 font-medium">
                                      {log.task?.title || 'No linked task'}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 font-bold text-primary">
                                    {log.duration} hrs
                                  </td>
                                  <td className="px-5 py-3.5 text-emerald-600 font-bold">
                                    {log.billable ? `$${value.toFixed(2)}` : '-'}
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[9px] font-black border ${log.endTime === null ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : log.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : log.status === 'SUBMITTED' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : log.status === 'REJECTED' ? 'bg-danger/10 text-danger border-danger/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}
                                    >
                                      {log.endTime === null ? 'RUNNING' : log.status}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 text-foreground/50">
                                    {new Date(log.startTime).toLocaleDateString()}
                                  </td>
                                  <td className="px-5 py-3.5 text-right space-x-1">
                                    {log.status === 'DRAFT' && log.endTime !== null && (
                                      <button
                                        onClick={() => handleSubmitLog(log.id)}
                                        className="px-2 py-1 text-primary hover:bg-primary/10 rounded font-black border border-primary/20"
                                      >
                                        Submit
                                      </button>
                                    )}
                                    {log.status !== 'APPROVED' && log.endTime !== null && (
                                      <>
                                        <button
                                          onClick={() => openEditLog(log)}
                                          className="p-1 text-foreground/50 hover:text-foreground transition rounded"
                                        >
                                          <Edit2 className="h-3.5 w-3.5 inline" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteLog(log.id)}
                                          className="p-1 text-danger hover:text-danger/80 transition rounded"
                                        >
                                          <Trash2 className="h-3.5 w-3.5 inline" />
                                        </button>
                                      </>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                );
              })}

              {filteredLogs.length === 0 && (
                <div className="py-16 text-center text-sm text-foreground/50 border border-dashed rounded-2xl bg-card">
                  No time sheets found matching the active filters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== APPROVALS TAB ===================== */}
        {activeTab === 'approvals' && (
          <div className="grid gap-6">
            {/* Sticky/Bulk action header */}
            {Object.values(selectedApprovalIds).some(Boolean) && (
              <Card className="p-4 border border-primary/20 bg-primary/5 flex items-center justify-between text-xs font-bold rounded-xl animate-fade-in shadow-sm">
                <span>
                  {Object.values(selectedApprovalIds).filter(Boolean).length} entries selected for
                  bulk processing
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={handleBulkReject}
                    variant="ghost"
                    className="h-9 px-3 rounded-lg text-danger border border-danger/20 hover:bg-danger/5 font-black"
                  >
                    ✕ Reject Selected
                  </Button>
                  <Button
                    onClick={handleBulkApprove}
                    className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black"
                  >
                    ✓ Approve Selected
                  </Button>
                </div>
              </Card>
            )}

            <Card className="p-0 overflow-hidden border border-border bg-card">
              <div className="px-5 py-4 border-b border-border flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-sm font-bold">
                  Pending Approvals Queue ({approvalLogs.length})
                </h3>
                {approvalLogs.length > 0 && (
                  <button
                    onClick={() => {
                      const allSelected = approvalLogs.every((log) => selectedApprovalIds[log.id]);
                      const nextSelect: Record<string, boolean> = {};
                      if (!allSelected) {
                        approvalLogs.forEach((log) => (nextSelect[log.id] = true));
                      }
                      setSelectedApprovalIds(nextSelect);
                    }}
                    className="text-[11px] text-primary font-black hover:underline"
                  >
                    {approvalLogs.every((log) => selectedApprovalIds[log.id])
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                )}
              </div>

              <div className="overflow-x-auto text-xs font-semibold">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border text-foreground/50 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-5 py-3 w-10">Select</th>
                      <th className="px-5 py-3">Staff Member</th>
                      <th className="px-5 py-3">Description</th>
                      <th className="px-5 py-3">Project</th>
                      <th className="px-5 py-3 text-center">Hours</th>
                      <th className="px-5 py-3">Billable</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {approvalLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/5 transition duration-150">
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() =>
                              setSelectedApprovalIds((prev) => ({
                                ...prev,
                                [log.id]: !prev[log.id],
                              }))
                            }
                            className="text-foreground/75 hover:text-primary transition"
                          >
                            {selectedApprovalIds[log.id] ? (
                              <CheckSquare className="h-4.5 w-4.5 text-primary" />
                            ) : (
                              <SquareIcon className="h-4.5 w-4.5 text-foreground/30" />
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 font-bold flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {log.user?.firstName.charAt(0)}
                          </div>
                          <span>
                            {log.user?.firstName} {log.user?.lastName}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-foreground/80">{log.description}</td>
                        <td className="px-5 py-3.5 font-mono">{log.project?.projectCode}</td>
                        <td className="px-5 py-3.5 text-center font-bold text-primary">
                          {log.duration} hrs
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black ${log.billable ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'}`}
                          >
                            {log.billable ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1">
                          <button
                            onClick={() => handleApprove(log.id)}
                            className="px-2.5 py-1 text-emerald-600 hover:bg-emerald-500/10 rounded font-black border border-emerald-500/20"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleReject(log.id)}
                            className="px-2.5 py-1 text-danger hover:bg-danger/10 rounded font-black border border-danger/20"
                          >
                            ✕ Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                    {approvalLogs.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-10 text-center text-foreground/45 italic"
                        >
                          No pending timesheet approvals in queue.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ===================== ANALYTICS TAB ===================== */}
        {activeTab === 'analytics' && (
          <div className="grid gap-6">
            {/* Top Stat widgets */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-5 flex flex-col justify-between border border-border bg-card">
                <div>
                  <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
                    Productivity Ratio
                  </span>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <TrendingUp className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <span className="block text-2xl font-black text-foreground">
                        {metrics.utilization}%
                      </span>
                      <span className="text-[10px] text-foreground/50">Billable allocation</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5 flex flex-col justify-between border border-border bg-card">
                <div>
                  <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
                    Billable Revenue
                  </span>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <DollarSign className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <span className="block text-2xl font-black text-emerald-600">
                        ${metrics.estimatedRevenue.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-foreground/50">
                        Weekly calculated revenue
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5 flex flex-col justify-between border border-border bg-card">
                <div>
                  <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
                    Total Logs Volume
                  </span>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                      <Clock className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <span className="block text-2xl font-black text-foreground">
                        {logs.length} logged
                      </span>
                      <span className="text-[10px] text-foreground/50">Total entries recorded</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Detailed visual Staff utilization breakdowns */}
            <Card className="p-0 overflow-hidden border border-border bg-card">
              <div className="px-5 py-4 border-b border-border flex justify-between items-center">
                <h3 className="text-sm font-bold">Hours Logged by Staff</h3>
                <span className="text-xs text-foreground/45 font-bold">
                  Total Staff work share metrics
                </span>
              </div>
              <div className="p-5 text-xs font-semibold space-y-4">
                {chartsData.staffData.map((d) => {
                  const maxHours = Math.max(...chartsData.staffData.map((e) => e.hours), 1);
                  const pct = Math.round((d.hours / maxHours) * 100);
                  return (
                    <div key={d.name}>
                      <div className="flex justify-between mb-1.5">
                        <span>{d.name}</span>
                        <span className="text-primary font-bold">{d.hours} hrs</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {chartsData.staffData.length === 0 && (
                  <div className="py-12 text-center text-foreground/45 italic">
                    No Staff tracking logs recorded.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ===================== MANUAL TIME ENTRY MODAL ===================== */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl p-6 relative bg-card border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-extrabold text-foreground">Add Manual Time Log</h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-foreground/45 hover:text-foreground"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="grid gap-4 text-xs">
              <div className="grid gap-1">
                <label className="font-semibold text-foreground/60">Select Project *</label>
                <select
                  value={manualForm.projectId}
                  onChange={(e) => setManualForm({ ...manualForm, projectId: e.target.value })}
                  className="h-10 rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold cursor-pointer"
                  required
                >
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="font-semibold text-foreground/60">Link Task (Optional)</label>
                <select
                  value={manualForm.taskId}
                  onChange={(e) => setManualForm({ ...manualForm, taskId: e.target.value })}
                  className="h-10 rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold cursor-pointer"
                >
                  <option value="">No task linked...</option>
                  {tasks
                    .filter((t) => t.projectId === manualForm.projectId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="font-semibold text-foreground/60">Start Time *</label>
                  <input
                    type="datetime-local"
                    value={manualForm.startTime}
                    onChange={(e) => setManualForm({ ...manualForm, startTime: e.target.value })}
                    className="h-10 rounded-xl border border-border bg-background px-3 outline-none font-semibold text-foreground focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <label className="font-semibold text-foreground/60">End Time *</label>
                  <input
                    type="datetime-local"
                    value={manualForm.endTime}
                    onChange={(e) => setManualForm({ ...manualForm, endTime: e.target.value })}
                    className="h-10 rounded-xl border border-border bg-background px-3 outline-none font-semibold text-foreground focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-1">
                <label className="font-semibold text-foreground/60">Work Description *</label>
                <input
                  type="text"
                  value={manualForm.description}
                  onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                  placeholder="e.g. Code Review, API Integration"
                  className="h-10 rounded-xl border border-border bg-background px-3 outline-none font-semibold text-foreground focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer py-1 font-semibold text-foreground/80">
                <input
                  type="checkbox"
                  checked={manualForm.billable}
                  onChange={(e) => setManualForm({ ...manualForm, billable: e.target.checked })}
                  className="h-4.5 w-4.5 rounded border-border"
                />
                Billable Time Entry
              </label>

              <div className="flex gap-2 justify-end mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowManualModal(false)}
                  className="h-10 rounded-xl px-4"
                >
                  Cancel
                </Button>
                <Button type="submit" className="h-10 rounded-xl px-5">
                  Log Time
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ===================== EDIT TIME ENTRY MODAL ===================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl p-6 relative bg-card border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-extrabold text-foreground">Edit Time Entry</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-foreground/45 hover:text-foreground"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="grid gap-4 text-xs">
              <div className="grid gap-1">
                <label className="font-semibold text-foreground/60">Select Project *</label>
                <select
                  value={editForm.projectId}
                  onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value })}
                  className="h-10 rounded-xl border border-border bg-background px-3 outline-none font-semibold cursor-pointer"
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="font-semibold text-foreground/60">Link Task (Optional)</label>
                <select
                  value={editForm.taskId}
                  onChange={(e) => setEditForm({ ...editForm, taskId: e.target.value })}
                  className="h-10 rounded-xl border border-border bg-background px-3 outline-none font-semibold cursor-pointer"
                >
                  <option value="">No task linked...</option>
                  {tasks
                    .filter((t) => t.projectId === editForm.projectId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="font-semibold text-foreground/60">Start Time *</label>
                  <input
                    type="datetime-local"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                    className="h-10 rounded-xl border border-border bg-background px-3 outline-none font-semibold"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <label className="font-semibold text-foreground/60">End Time</label>
                  <input
                    type="datetime-local"
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    className="h-10 rounded-xl border border-border bg-background px-3 outline-none font-semibold"
                  />
                </div>
              </div>

              <div className="grid gap-1">
                <label className="font-semibold text-foreground/60">Work Description *</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="h-10 rounded-xl border border-border bg-background px-3 outline-none font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 cursor-pointer py-1 font-semibold text-foreground/80">
                  <input
                    type="checkbox"
                    checked={editForm.billable}
                    onChange={(e) => setEditForm({ ...editForm, billable: e.target.checked })}
                    className="h-4.5 w-4.5 rounded border-border"
                  />
                  Billable Time
                </label>

                {isAdmin && (
                  <div className="grid gap-1">
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="h-8 rounded-lg border border-border bg-background px-2 font-bold cursor-pointer text-[10px]"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="SUBMITTED">SUBMITTED</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowEditModal(false)}
                  className="h-10 rounded-xl px-4"
                >
                  Cancel
                </Button>
                <Button type="submit" className="h-10 rounded-xl px-5">
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
