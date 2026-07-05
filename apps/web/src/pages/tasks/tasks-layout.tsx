import { useState } from 'react';
import { TasksBoard } from './tasks-board';
import { TasksListPage } from './tasks-list';
import { TasksCalendar } from './tasks-calendar';
import { TasksDashboard } from './tasks-dashboard';
import { Card } from '../../components/ui/card';
import { Kanban, ListTodo, CalendarDays, LayoutDashboard } from 'lucide-react';

type TasksViewMode = 'board' | 'list' | 'calendar' | 'dashboard';

export function TasksLayoutPage() {
  const [mode, setMode] = useState<TasksViewMode>('board');

  return (
    <div className="grid gap-6 h-full">
      {/* Tab Navigation header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks Workspace</h1>
          <p className="text-sm text-foreground/60 mt-1">
            Organize sprints, track execution statuses, and view deadliness.
          </p>
        </div>

        {/* View toggle tabs */}
        <div className="flex border border-border bg-card rounded-lg p-1 text-xs font-semibold">
          {(
            [
              { id: 'board', label: 'Kanban Board', icon: Kanban },
              { id: 'list', label: 'List View', icon: ListTodo },
              { id: 'calendar', label: 'Calendar', icon: CalendarDays },
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                mode === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground/60 hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Views */}
      <div className="flex-1">
        {mode === 'board' && <TasksBoard />}
        {mode === 'list' && <TasksListPage />}
        {mode === 'calendar' && <TasksCalendar />}
        {mode === 'dashboard' && <TasksDashboard />}
      </div>
    </div>
  );
}
