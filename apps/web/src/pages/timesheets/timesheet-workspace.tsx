import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import type { TimeLog, Project, Task } from '@clientflow/types';
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
} from 'lucide-react';

export function TimesheetWorkspacePage() {
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Active timer stopwatch state
  const [activeTimer, setActiveTimer] = useState<TimeLog | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerDescription, setTimerDescription] = useState('');
  const [timerProjectId, setTimerProjectId] = useState('');
  const [timerTaskId, setTimerTaskId] = useState('');
  const timerIntervalRef = useRef<number | null>(null);

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

  // Admin approval list
  const [pendingLogs, setPendingLogs] = useState<TimeLog[]>([]);

  const loadFilterOptions = async () => {
    try {
      const [prjRes, tskRes] = await Promise.all([
        api.get('/projects?limit=1000'),
        api.get('/tasks'),
      ]);
      const prjs = prjRes.data.data?.items ?? [];
      setProjects(prjs);
      setTasks(tskRes.data.data ?? []);
      if (prjs.length > 0) {
        setTimerProjectId(prjs[0].id);
        setManualForm((f) => ({ ...f, projectId: prjs[0].id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadTimeLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/timelogs');
      setLogs(res.data.data ?? []);

      // Only admins approve submitted time logs.
      if (user?.role === 'ADMIN') {
        const pRes = await api.get('/timelogs?status=SUBMITTED');
        setPendingLogs(pRes.data.data ?? []);
      }
    } catch (err) {
      notify({ type: 'error', title: 'Load Failed', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const loadActiveTimer = async () => {
    try {
      const res = await api.get('/timer/active');
      const active = res.data.data;
      if (active) {
        setActiveTimer(active);
        setTimerDescription(active.description);
        setTimerProjectId(active.projectId);
        setTimerTaskId(active.taskId || '');

        const start = new Date(active.startTime).getTime();
        const diffSecs = Math.floor((Date.now() - start) / 1000);
        setTimerSeconds(diffSecs);

        startStopwatchInterval();
      } else {
        setActiveTimer(null);
        setTimerSeconds(0);
        stopStopwatchInterval();
      }
    } catch (err) {
      console.error(err);
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

  // Stopwatch counter trigger
  const startStopwatchInterval = () => {
    if (timerIntervalRef.current) return;
    timerIntervalRef.current = window.setInterval(() => {
      setTimerSeconds((prev) => {
        // Warn if timer runs too long (> 8 hours)
        if (prev === 28800) {
          notify({
            type: 'error',
            title: 'Timer Alert',
            message: 'Your active timer has been running for 8 hours. Remember to log your exit!',
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

  // Timer controls
  const handleStartTimer = async () => {
    if (!timerProjectId) {
      notify({
        type: 'error',
        title: 'Missing parameters',
        message: 'Please select a project first',
      });
      return;
    }
    if (!timerDescription.trim()) {
      notify({
        type: 'error',
        title: 'Missing parameters',
        message: 'Please enter a stopwatch description',
      });
      return;
    }

    try {
      const res = await api.post('/timer/start', {
        projectId: timerProjectId,
        taskId: timerTaskId || null,
        description: timerDescription,
      });
      setActiveTimer(res.data.data);
      setTimerSeconds(0);
      startStopwatchInterval();
      notify({ type: 'success', title: 'Timer started' });
    } catch (err) {
      notify({ type: 'error', title: 'Action Failed', message: errorMessage(err) });
    }
  };

  const handleStopTimer = async () => {
    try {
      stopStopwatchInterval();
      await api.post('/timer/stop');
      setActiveTimer(null);
      setTimerSeconds(0);
      setTimerDescription('');
      notify({ type: 'success', title: 'Time log recorded successfully' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Stop Failed', message: errorMessage(err) });
      startStopwatchInterval(); // resume timer in UI
    }
  };

  // Submit log
  const handleSubmitLog = async (id: string) => {
    try {
      await api.post(`/timelogs/${id}/submit`);
      notify({ type: 'success', title: 'Timesheet submitted for review' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Submission Failed', message: errorMessage(err) });
    }
  };

  // Delete manual entry
  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Delete this time entry?')) return;
    try {
      await api.delete(`/timelogs/${id}`);
      notify({ type: 'success', title: 'Entry deleted' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Failed to delete', message: errorMessage(err) });
    }
  };

  // Manual Log form submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.projectId || !manualForm.description.trim()) return;

    try {
      await api.post('/timelogs', manualForm);
      notify({ type: 'success', title: 'Time log entry added' });
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
      notify({ type: 'error', title: 'Failed to Add Entry', message: errorMessage(err) });
    }
  };

  // Admin approvals
  const handleApprove = async (id: string) => {
    try {
      await api.post(`/timelogs/${id}/approve`);
      notify({ type: 'success', title: 'Time log approved' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Failed to approve', message: errorMessage(err) });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.post(`/timelogs/${id}/reject`);
      notify({ type: 'success', title: 'Time entry rejected' });
      loadTimeLogs();
    } catch (err) {
      notify({ type: 'error', title: 'Failed to reject', message: errorMessage(err) });
    }
  };

  // Helper formatting seconds -> HH:MM:SS
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

  // Filter tasks belonging to selected project
  const projectTasks = tasks.filter(
    (t) => t.projectId === (activeTimer ? activeTimer.projectId : timerProjectId),
  );

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="grid gap-6">
      {/* Title */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Time Sheets</h1>
          <p className="text-sm text-foreground/50 mt-1">
            Track billable hours with live stopwatch timers or submit weekly timesheets.
          </p>
        </div>

        <Button onClick={() => setShowManualModal(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Manual Time
        </Button>
      </div>

      {/* STOPWATCH HEADER CARD */}
      <Card className="border border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                Stopwatch Tracker
              </span>
              <span className="block font-mono text-2xl font-bold text-foreground mt-0.5">
                {formatStopwatch(timerSeconds)}
              </span>
            </div>
          </div>

          {/* Description & Selection fields */}
          <div className="grid gap-3 sm:grid-cols-3 flex-1 w-full text-xs">
            <input
              type="text"
              placeholder="What are you working on? (e.g. Code Review)"
              value={timerDescription}
              onChange={(e) => setTimerDescription(e.target.value)}
              className="h-10 rounded border border-border bg-background px-3 outline-none"
              disabled={!!activeTimer}
            />

            <select
              value={timerProjectId}
              onChange={(e) => setTimerProjectId(e.target.value)}
              className="h-10 rounded border border-border bg-background px-2"
              disabled={!!activeTimer}
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName}
                </option>
              ))}
            </select>

            <select
              value={timerTaskId}
              onChange={(e) => setTimerTaskId(e.target.value)}
              className="h-10 rounded border border-border bg-background px-2"
              disabled={!!activeTimer}
            >
              <option value="">Select task (optional)...</option>
              {projectTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="shrink-0 w-full lg:w-auto flex justify-end">
            {activeTimer ? (
              <Button
                onClick={handleStopTimer}
                className="w-full lg:w-auto bg-danger hover:bg-danger/90 text-white flex items-center justify-center gap-2"
              >
                <Square className="h-4.5 w-4.5" /> Stop Timer
              </Button>
            ) : (
              <Button
                onClick={handleStartTimer}
                className="w-full lg:w-auto bg-primary hover:bg-primary/95 flex items-center justify-center gap-2"
              >
                <Play className="h-4.5 w-4.5" /> Start Timer
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ADMIN PENDING TIME APPROVALS BOARD */}
      {pendingLogs.length > 0 && (
        <Card className="border border-orange-500/20 bg-orange-500/5">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
            <AlertCircle className="h-4.5 w-4.5 text-orange-500" /> Pending Timesheet Approvals (
            {pendingLogs.length})
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 pb-2 text-foreground/60 font-semibold">
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Project</th>
                  <th className="py-2 pr-3 text-center">Hours</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {pendingLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/10">
                    <td className="py-3 pr-3 font-semibold">
                      {log.user?.firstName} {log.user?.lastName}
                    </td>
                    <td className="py-3 pr-3 text-foreground/80">{log.description}</td>
                    <td className="py-3 pr-3 font-mono">{log.project?.projectCode}</td>
                    <td className="py-3 pr-3 text-center font-bold">{log.duration} hrs</td>
                    <td className="py-3 text-right space-x-1.5 shrink-0">
                      <button
                        onClick={() => handleApprove(log.id)}
                        className="p-1 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-md font-bold"
                        title="Approve"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleReject(log.id)}
                        className="p-1 text-danger bg-danger/10 hover:bg-danger/20 rounded-md font-bold"
                        title="Request Changes"
                      >
                        ✕ Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* WEEKLY TIMESHEETS LIST TABLE */}
      <Card className="p-0 overflow-hidden text-xs">
        <div className="flex justify-between items-center border-b border-border px-5 py-4">
          <h3 className="font-bold text-sm">Timesheets History</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/30 border-b border-border font-bold text-foreground/75">
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Project / Task</th>
                <th className="px-5 py-3">Hours</th>
                <th className="px-5 py-3">Value</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-foreground/45">
                    Loading time sheets...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-foreground/45 italic">
                    No time entries logged.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/10 transition">
                    <td className="px-5 py-3.5">
                      <span className="font-semibold block text-foreground/90">
                        {log.description}
                      </span>
                      {log.billable && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1 rounded-sm mt-0.5">
                          <DollarSign className="h-2.5 w-2.5" /> Billable
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div>
                        <span className="block font-semibold">{log.project?.projectName}</span>
                        <span className="text-[10px] text-foreground/45 font-mono">
                          {log.task?.title || 'No Task linked'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-primary">{log.duration} hrs</td>
                    <td className="px-5 py-3.5 font-bold text-emerald-600">
                      {log.billable
                        ? `$${(Number(log.duration || 0) * Number(log.hourlyRateSnapshot || 0)).toLocaleString()}`
                        : '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : log.status === 'SUBMITTED'
                              ? 'bg-primary/10 text-primary animate-pulse'
                              : log.status === 'REJECTED'
                                ? 'bg-danger/10 text-danger'
                                : 'bg-slate-400/10 text-slate-500'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-foreground/50">
                      {new Date(log.startTime).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1.5 shrink-0">
                      {log.status === 'DRAFT' && (
                        <button
                          onClick={() => handleSubmitLog(log.id)}
                          className="px-2 py-1 text-primary bg-primary/10 hover:bg-primary/20 rounded font-bold"
                        >
                          Submit Log
                        </button>
                      )}
                      {log.status !== 'APPROVED' && (
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="px-2 py-1 text-danger bg-danger/10 hover:bg-danger/20 rounded font-bold"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MANUAL TIME LOG ENTRY MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl p-6 relative">
            <h3 className="text-base font-bold mb-4">Add Manual Time Log</h3>
            <form onSubmit={handleManualSubmit} className="grid gap-3 text-xs">
              <div className="grid gap-1">
                <label className="font-semibold">Select Project *</label>
                <select
                  value={manualForm.projectId}
                  onChange={(e) => setManualForm({ ...manualForm, projectId: e.target.value })}
                  className="h-10 rounded border border-border bg-background px-3"
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
                <label className="font-semibold">Select Task (Optional)</label>
                <select
                  value={manualForm.taskId}
                  onChange={(e) => setManualForm({ ...manualForm, taskId: e.target.value })}
                  className="h-10 rounded border border-border bg-background px-3"
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
                  <label className="font-semibold">Start Time *</label>
                  <input
                    type="datetime-local"
                    value={manualForm.startTime}
                    onChange={(e) => setManualForm({ ...manualForm, startTime: e.target.value })}
                    className="h-10 rounded border border-border bg-background px-3 outline-none"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <label className="font-semibold">End Time *</label>
                  <input
                    type="datetime-local"
                    value={manualForm.endTime}
                    onChange={(e) => setManualForm({ ...manualForm, endTime: e.target.value })}
                    className="h-10 rounded border border-border bg-background px-3 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-1">
                <label className="font-semibold">Work Description *</label>
                <input
                  type="text"
                  value={manualForm.description}
                  onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                  placeholder="e.g. Refactoring routes validations models"
                  className="h-10 rounded border border-border bg-background px-3 outline-none"
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer py-1 font-semibold">
                <input
                  type="checkbox"
                  checked={manualForm.billable}
                  onChange={(e) => setManualForm({ ...manualForm, billable: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                Billable Time Entry
              </label>

              <div className="flex gap-2 justify-end mt-3">
                <Button type="button" variant="ghost" onClick={() => setShowManualModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Log Time</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
