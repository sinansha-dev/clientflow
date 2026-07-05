import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import { TaskDetailsDrawer } from '../../components/tasks/task-details-drawer';
import type { Task, Project, AuthUser, TaskLabel } from '@clientflow/types';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  PlusCircle,
  Tag,
  Paperclip,
  CheckSquare,
  MessageSquare,
  Clock,
  AlertCircle,
} from 'lucide-react';

const COLUMNS = [
  { id: 'BACKLOG', label: 'Backlog', color: 'border-t-slate-400 bg-slate-500/5' },
  { id: 'TODO', label: 'To Do', color: 'border-t-blue-400 bg-blue-500/5' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-t-amber-400 bg-amber-500/5' },
  { id: 'REVIEW', label: 'Review', color: 'border-t-purple-400 bg-purple-500/5' },
  { id: 'TESTING', label: 'Testing', color: 'border-t-indigo-400 bg-indigo-500/5' },
  { id: 'BLOCKED', label: 'Blocked', color: 'border-t-danger bg-danger/5' },
  { id: 'COMPLETED', label: 'Completed', color: 'border-t-emerald-400 bg-emerald-500/5' },
];

interface TasksBoardProps {
  projectId?: string; // Optional scoping
}

export function TasksBoard({ projectId: scopedProjectId }: TasksBoardProps) {
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [team, setTeam] = useState<AuthUser[]>([]);
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState(scopedProjectId || 'ALL');
  const [assigneeId, setAssigneeId] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [labelId, setLabelId] = useState('ALL');

  // Drawer / Modals
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Quick adds inline helper
  const [quickAddColumn, setQuickAddColumn] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  const loadFilterOptions = async () => {
    try {
      const [prjRes, usrRes, lblRes] = await Promise.all([
        api.get('/projects?limit=1000'),
        api.get('/users'),
        api.get('/labels'),
      ]);
      setProjects(prjRes.data.data?.items ?? []);
      setTeam((usrRes.data.data ?? []).filter((u: AuthUser) => u.role !== 'CLIENT'));
      setLabels(lblRes.data.data ?? []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const qParams = new URLSearchParams({
        projectId: scopedProjectId || projectId,
        assigneeId,
        labelId,
        priority,
        search,
      });
      const res = await api.get(`/tasks?${qParams.toString()}`);
      setTasks(res.data.data ?? []);
    } catch (err) {
      notify({ type: 'error', title: 'Error loading tasks', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [projectId, assigneeId, priority, labelId, scopedProjectId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTasks();
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow drop
  };

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const taskToMove = tasks.find((t) => t.id === taskId);
    if (!taskToMove || taskToMove.status === status) return;

    // Optimistic UI updates
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));

    try {
      await api.patch(`/tasks/${taskId}/move`, { status });
      notify({ type: 'success', title: 'Task position saved' });
      loadTasks();
    } catch (err) {
      notify({ type: 'error', title: 'Drop Failed', message: errorMessage(err) });
      loadTasks(); // rollback
    }
  };

  // --- Inline Quick Add Task ---
  const handleQuickAddSubmit = async (e: React.FormEvent, colId: string) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) return;

    let targetProjectId = scopedProjectId || projectId;
    if (targetProjectId === 'ALL') {
      // Pick first active project
      if (projects.length === 0) {
        notify({
          type: 'error',
          title: 'No Projects Available',
          message: 'Create a project first before registering tasks',
        });
        return;
      }
      targetProjectId = projects[0]?.id || '';
    }

    try {
      await api.post('/tasks', {
        projectId: targetProjectId,
        title: quickAddTitle,
        status: colId,
        priority: 'MEDIUM',
      });
      setQuickAddTitle('');
      setQuickAddColumn(null);
      loadTasks();
    } catch (err) {
      notify({ type: 'error', title: 'Task Creation Failed', message: errorMessage(err) });
    }
  };

  return (
    <div className="grid gap-6 h-full flex-1">
      {/* Filters (only show if not scoped to project detail workspace) */}
      {!scopedProjectId && (
        <Card className="flex flex-wrap gap-3 items-end">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          <div className="grid gap-1 min-w-[150px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2.5 text-xs"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1 min-w-[150px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
              Assignee
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2.5 text-xs"
            >
              <option value="ALL">All Assignees</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1 min-w-[130px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2.5 text-xs"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </Card>
      )}

      {/* Kanban Columns Drag Area */}
      <div className="flex gap-4 overflow-x-auto pb-4 select-none items-start min-h-[60vh]">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex w-72 shrink-0 flex-col rounded-lg border-t-4 border border-border/80 p-3 shadow-sm min-h-[450px] max-h-[75vh] ${col.color}`}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-sm text-foreground/80 flex items-center gap-1.5">
                  {col.label}
                  <span className="bg-muted px-2 py-0.5 text-[10px] rounded-full text-foreground/60">
                    {colTasks.length}
                  </span>
                </span>
                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => setQuickAddColumn(quickAddColumn === col.id ? null : col.id)}
                    className="p-1 hover:bg-muted text-foreground/50 hover:text-foreground rounded"
                    type="button"
                    aria-label="Quick Add"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Inline Quick Add form */}
              {quickAddColumn === col.id && (
                <form
                  onSubmit={(e) => handleQuickAddSubmit(e, col.id)}
                  className="bg-card border border-border p-2.5 rounded-lg mb-3 shadow-xs"
                >
                  <input
                    type="text"
                    value={quickAddTitle}
                    onChange={(e) => setQuickAddTitle(e.target.value)}
                    placeholder="Task title..."
                    className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 outline-none mb-2 focus:border-primary"
                    required
                    autoFocus
                  />
                  <div className="flex gap-1.5 justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setQuickAddColumn(null)}
                      className="h-7 text-[10px] px-2"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="h-7 text-[10px] px-2.5">
                      Add Task
                    </Button>
                  </div>
                </form>
              )}

              {/* Column Cards List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[60vh] pr-0.5">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="bg-card border border-border/80 p-3 rounded-lg shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing hover:border-primary/20 transition duration-150 flex flex-col gap-2"
                  >
                    {/* Project Label (only in global board) */}
                    {!scopedProjectId && (
                      <span className="text-[9px] font-bold text-primary font-mono tracking-wide uppercase">
                        {task.project?.projectCode}
                      </span>
                    )}

                    <h4 className="font-semibold text-xs text-foreground/90 leading-relaxed block break-words">
                      {task.title}
                    </h4>

                    {/* Stats Icons & Assignee */}
                    <div className="flex items-center justify-between text-[10px] text-foreground/45 border-t border-border/40 pt-2">
                      <div className="flex gap-2">
                        {task.checklist && task.checklist.length > 0 && (
                          <div className="flex items-center gap-0.5" title="Checklist progress">
                            <CheckSquare className="h-3.5 w-3.5" />
                            <span>
                              {task.checklist.filter((chk) => chk.completed).length}/
                              {task.checklist.length}
                            </span>
                          </div>
                        )}
                        {task.dueDate && (
                          <div
                            className="flex items-center gap-0.5 text-orange-500 font-semibold"
                            title="Due Date"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {new Date(task.dueDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        )}
                        <span
                          className={`text-[9px] font-bold ${
                            task.priority === 'CRITICAL'
                              ? 'text-danger'
                              : task.priority === 'HIGH'
                                ? 'text-orange-500'
                                : task.priority === 'MEDIUM'
                                  ? 'text-primary'
                                  : 'text-foreground/50'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>

                      {/* Assignees avatars list */}
                      <div className="flex -space-x-1 overflow-hidden">
                        {task.assignees?.map((a) => (
                          <div
                            key={a.id}
                            title={`${a.firstName} ${a.lastName}`}
                            className="inline-block h-5.5 w-5.5 rounded-full ring-2 ring-background bg-primary/10 flex items-center justify-center text-[8px] font-semibold text-primary"
                          >
                            {a.firstName.charAt(0)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Drawer details */}
      {selectedTaskId && (
        <TaskDetailsDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={loadTasks}
        />
      )}
    </div>
  );
}
