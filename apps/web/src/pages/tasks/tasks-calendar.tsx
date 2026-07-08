import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useToastStore } from '../../stores/toast-store';
import { errorMessage } from '../../lib/errors';
import { TaskDetailsDrawer } from '../../components/tasks/task-details-drawer';
import type { Task, Project } from '@clientflow/types';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

export function TasksCalendar({ projectId: scopedProjectId }: { projectId?: string } = {}) {
  const notify = useToastStore((state) => state.notify);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(scopedProjectId || 'ALL');
  const [loading, setLoading] = useState(true);

  // Calendar dates
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prjsRes, tsksRes] = await Promise.all([
        api.get('/projects?limit=1000'),
        api.get(`/tasks?projectId=${projectId}`),
      ]);
      setProjects(prjsRes.data.data?.items ?? []);
      setTasks(tsksRes.data.data ?? []);
    } catch (err) {
      notify({ type: 'error', title: 'Load Failed', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Navigate months
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Generate calendar days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const days: Date[] = [];
  // Days of previous month padding
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, prevMonthTotalDays - i));
  }

  // Days of current month
  for (let i = 1; i <= totalDays; i++) {
    days.push(new Date(year, month, i));
  }

  // Days of next month padding to make complete week rows (42 cells total)
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push(new Date(year, month + 1, i));
  }

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  return (
    <div className="grid gap-6">
      {/* Filters Bar */}
      <Card className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">
            {monthName} {year}
          </h2>
          <div className="flex gap-1.5 ml-2">
            <Button variant="ghost" onClick={prevMonth} className="h-8 w-8 p-0 border">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={nextMonth} className="h-8 w-8 p-0 border">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!scopedProjectId && (
          <div className="grid gap-1 min-w-[200px] text-xs">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-9 rounded border border-border bg-background px-3 font-semibold"
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
      </Card>

      {/* Calendar Grid */}
      <Card className="p-0 overflow-hidden border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-bold uppercase tracking-wider text-foreground/60 py-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-border bg-card">
          {days.map((date, idx) => {
            const isCurrentMonth = date.getMonth() === month;
            const dateStr = date.toISOString().split('T')[0];

            // Find tasks due on this date
            const dueTasks = tasks.filter((t) => {
              if (!t.dueDate) return false;
              const due = new Date(t.dueDate).toISOString().split('T')[0];
              return due === dateStr;
            });

            return (
              <div
                key={idx}
                className={`min-h-[100px] p-2 space-y-1.5 flex flex-col ${
                  isCurrentMonth ? 'text-foreground' : 'bg-muted/10 text-foreground/30'
                }`}
              >
                <span className="text-xs font-bold font-mono self-end">{date.getDate()}</span>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {dueTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className={`text-[10px] p-1 rounded font-semibold truncate cursor-pointer transition select-none ${
                        t.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-primary/10 text-primary border border-primary/20'
                      }`}
                    >
                      {t.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Task details drawer */}
      {selectedTaskId && (
        <TaskDetailsDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}
