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
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Plus,
  Trash2,
  Calendar,
  CheckSquare,
  Clock,
  ArrowUpDown,
  Tag,
} from 'lucide-react';

export function TasksListPage({ projectId: scopedProjectId }: { projectId?: string } = {}) {
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
  const [status, setStatus] = useState('ALL');
  const [labelId, setLabelId] = useState('ALL');

  // Sorting
  const [sortBy, setSortBy] = useState('position');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Drawer / Modals
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // New task form state
  const [newForm, setNewForm] = useState({
    projectId: '',
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '',
  });

  const loadFilterOptions = async () => {
    try {
      const [prjRes, usrRes, lblRes] = await Promise.all([
        api.get('/projects?limit=1000'),
        api.get('/users/staff'),
        api.get('/labels'),
      ]);
      const prjs = prjRes.data.data?.items ?? [];
      setProjects(prjs);
      setTeam((usrRes.data.data?.users ?? []).filter((u: AuthUser) => u.role !== 'CLIENT'));
      setLabels(lblRes.data.data ?? []);

      if (scopedProjectId) {
        setNewForm((f) => ({ ...f, projectId: scopedProjectId }));
      } else if (prjs.length > 0) {
        setNewForm((f) => ({ ...f, projectId: prjs[0].id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const qParams = new URLSearchParams({
        projectId,
        assigneeId,
        labelId,
        priority,
        status,
        search,
        sortBy,
        sortOrder,
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
  }, [projectId, assigneeId, priority, status, labelId, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTasks();
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Handle task creation
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.projectId || !newForm.title.trim()) return;

    try {
      await api.post('/tasks', newForm);
      notify({ type: 'success', title: 'Task Created' });
      setShowCreateForm(false);
      setNewForm((f) => ({
        ...f,
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        dueDate: '',
      }));
      loadTasks();
    } catch (err) {
      notify({ type: 'error', title: 'Create Failed', message: errorMessage(err) });
    }
  };

  const canCreateTasks = user?.role === 'ADMIN' || user?.role === 'STAFF';

  return (
    <div className="grid gap-6">
      {/* Filters Bar */}
      <Card className="grid gap-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 min-w-[260px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by task title..."
                className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          {canCreateTasks && (
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Create Task
            </Button>
          )}
        </div>

        {/* Multi-value Dropdowns */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 border-t border-border pt-4 text-xs">
          {!scopedProjectId && (
            <div className="grid gap-1">
              <label className="font-semibold text-foreground/50">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="h-9 rounded border border-border bg-background px-2"
              >
                <option value="ALL">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-1">
            <label className="font-semibold text-foreground/50">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded border border-border bg-background px-2"
            >
              <option value="ALL">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REVIEW">Review</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="font-semibold text-foreground/50">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="h-9 rounded border border-border bg-background px-2"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="font-semibold text-foreground/50">Assignee</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="h-9 rounded border border-border bg-background px-2"
            >
              <option value="ALL">All Assignees</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label className="font-semibold text-foreground/50">Label</label>
            <select
              value={labelId}
              onChange={(e) => setLabelId(e.target.value)}
              className="h-9 rounded border border-border bg-background px-2"
            >
              <option value="ALL">All Labels</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* CREATE TASK DRAWER FORM */}
      {showCreateForm && (
        <Card className="border border-primary/20 bg-primary/5">
          <h3 className="text-sm font-bold mb-4">Create New Task</h3>
          <form onSubmit={handleCreateTask} className="grid gap-4 sm:grid-cols-2 text-xs">
            <div className="grid gap-1">
              <label className="font-semibold">Select Project *</label>
              <select
                value={newForm.projectId}
                onChange={(e) => setNewForm({ ...newForm, projectId: e.target.value })}
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
              <label className="font-semibold">Task Title *</label>
              <input
                type="text"
                value={newForm.title}
                onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                placeholder="e.g. Design Dashboard Prototypes"
                className="h-10 rounded border border-border bg-background px-3 outline-none"
                required
              />
            </div>

            <div className="grid gap-1">
              <label className="font-semibold">Status</label>
              <select
                value={newForm.status}
                onChange={(e) => setNewForm({ ...newForm, status: e.target.value })}
                className="h-10 rounded border border-border bg-background px-3"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="font-semibold">Priority</label>
              <select
                value={newForm.priority}
                onChange={(e) => setNewForm({ ...newForm, priority: e.target.value })}
                className="h-10 rounded border border-border bg-background px-3"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="font-semibold">Due Date</label>
              <input
                type="date"
                value={newForm.dueDate}
                onChange={(e) => setNewForm({ ...newForm, dueDate: e.target.value })}
                className="h-10 rounded border border-border bg-background px-3 outline-none"
              />
            </div>

            <div className="grid gap-1 sm:col-span-2">
              <label className="font-semibold">Description</label>
              <textarea
                value={newForm.description}
                onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                className="rounded border border-border bg-background px-3 py-2 outline-none"
                rows={3}
                placeholder="Details about task criteria, objectives, subtasks etc."
              />
            </div>

            <div className="flex gap-2 justify-end sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Task</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Task List Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 font-semibold text-foreground/80">
                <th className="px-6 py-4 cursor-pointer" onClick={() => toggleSort('title')}>
                  <div className="flex items-center gap-1">
                    Task Title <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 cursor-pointer" onClick={() => toggleSort('priority')}>
                  <div className="flex items-center gap-1">
                    Priority <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer" onClick={() => toggleSort('dueDate')}>
                  <div className="flex items-center gap-1">
                    Due Date <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-6 py-4">Assignees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-foreground/50">
                    Loading tasks...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-foreground/50">
                    No tasks found.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="cursor-pointer hover:bg-muted/40 transition"
                  >
                    <td className="px-6 py-4 font-semibold text-foreground/90">{task.title}</td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-semibold block text-xs">
                          {task.project?.projectName}
                        </span>
                        <span className="text-[10px] text-foreground/45 font-mono">
                          {task.project?.projectCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded text-foreground/80">
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-bold ${
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
                    </td>
                    <td className="px-6 py-4 text-xs text-foreground/60">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex -space-x-1 overflow-hidden">
                        {task.assignees?.map((a) => (
                          <div
                            key={a.id}
                            title={`${a.firstName} ${a.lastName}`}
                            className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary"
                          >
                            {a.firstName.charAt(0)}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Task Drawer Details */}
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
