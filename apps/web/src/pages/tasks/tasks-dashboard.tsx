import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import { TaskDetailsDrawer } from '../../components/tasks/task-details-drawer';
import type { Task } from '@clientflow/types';
import { CheckCircle, Clock, ListTodo, AlertCircle, Calendar, Zap } from 'lucide-react';

export function TasksDashboard() {
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks');
      setTasks(res.data.data ?? []);
    } catch (err) {
      notify({ type: 'error', title: 'Load Failed', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // --- Calculations ---
  const myTasks = tasks.filter((t) => t.assignees?.some((a) => a.id === user?.id));

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Overdue
  const overdueTasks = tasks.filter(
    (t) => t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < now,
  );

  // Due today
  const dueTodayTasks = tasks.filter((t) => {
    if (!t.dueDate || t.status === 'COMPLETED') return false;
    const due = new Date(t.dueDate).toISOString().split('T')[0];
    return due === todayStr;
  });

  // Due this week
  const oneWeekLater = new Date();
  oneWeekLater.setDate(now.getDate() + 7);
  const dueThisWeekTasks = tasks.filter((t) => {
    if (!t.dueDate || t.status === 'COMPLETED') return false;
    const due = new Date(t.dueDate);
    return due >= now && due <= oneWeekLater;
  });

  // Completed Today
  const completedTodayTasks = tasks.filter((t) => {
    if (t.status !== 'COMPLETED' || !t.completedAt) return false;
    const completedDate = new Date(t.completedAt).toISOString().split('T')[0];
    return completedDate === todayStr;
  });

  // High / Critical Priority
  const highPriorityTasks = tasks.filter(
    (t) => t.status !== 'COMPLETED' && (t.priority === 'HIGH' || t.priority === 'CRITICAL'),
  );

  // Recently updated
  const recentlyUpdatedTasks = [...tasks]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const widgets = [
    { label: 'Assigned to Me', value: myTasks.length, icon: ListTodo, color: 'text-primary' },
    { label: 'Overdue Tasks', value: overdueTasks.length, icon: AlertCircle, color: 'text-danger' },
    { label: 'Due Today', value: dueTodayTasks.length, icon: Calendar, color: 'text-orange-500' },
    {
      label: 'Completed Today',
      value: completedTodayTasks.length,
      icon: CheckCircle,
      color: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid gap-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Tasks Dashboard</h2>
        <p className="text-xs text-foreground/50 mt-1">
          Review deadlines, tasks status distribution, and work velocity.
        </p>
      </div>

      {/* Grid Widgets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {widgets.map((w) => (
          <Card key={w.label} className="flex justify-between items-center p-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                {w.label}
              </span>
              <span className={`block text-3xl font-bold mt-2 ${w.color}`}>
                {loading ? '...' : w.value}
              </span>
            </div>
            <div className="h-11 w-11 rounded-lg bg-muted/40 flex items-center justify-center text-foreground/50">
              <w.icon className="h-5.5 w-5.5" />
            </div>
          </Card>
        ))}
      </div>

      {/* Main lists */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* High priority */}
        <Card className="flex flex-col gap-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <Zap className="h-4.5 w-4.5 text-orange-500" /> Critical & High Priority
          </h3>
          <div className="flex-1 space-y-2 mt-2">
            {highPriorityTasks.length === 0 ? (
              <span className="text-xs text-foreground/40 italic">No high priority issues</span>
            ) : (
              highPriorityTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className="flex items-center justify-between text-xs p-2.5 bg-muted/20 border border-border/50 rounded-lg hover:border-primary/20 cursor-pointer"
                >
                  <div>
                    <span className="font-semibold block">{t.title}</span>
                    <span className="text-[9px] text-foreground/45 font-mono">
                      {t.project?.projectCode}
                    </span>
                  </div>
                  <span className="text-danger font-bold text-[10px]">{t.priority}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recently Updated */}
        <Card className="flex flex-col gap-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <Clock className="h-4.5 w-4.5 text-primary" /> Recently Updated
          </h3>
          <div className="flex-1 space-y-2 mt-2">
            {recentlyUpdatedTasks.length === 0 ? (
              <span className="text-xs text-foreground/40 italic">No tasks logged</span>
            ) : (
              recentlyUpdatedTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className="flex items-center justify-between text-xs p-2.5 bg-muted/20 border border-border/50 rounded-lg hover:border-primary/20 cursor-pointer"
                >
                  <div>
                    <span className="font-semibold block">{t.title}</span>
                    <span className="text-[9px] text-foreground/50">{t.status}</span>
                  </div>
                  <span className="text-[10px] text-foreground/45">
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Task Drawer */}
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
