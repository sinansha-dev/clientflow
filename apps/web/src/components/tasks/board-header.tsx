import { Bell, Plus, KanbanSquare } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuthStore } from '../../stores/auth-store';

interface BoardHeaderProps {
  onCreateTaskClick: () => void;
  canCreate?: boolean;
}

export function BoardHeader({ onCreateTaskClick, canCreate = false }: BoardHeaderProps) {
  const { user } = useAuthStore();

  const getInitials = () => {
    if (!user) return '?';
    return (
      `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.toUpperCase() || 'U'
    );
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
      {/* Title Area */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 text-primary rounded-2xl hidden sm:block">
          <KanbanSquare className="h-6 w-6 stroke-[1.8]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tasks</h1>
          <p className="text-xs text-foreground/50 mt-0.5">
            Manage project workflow, track progress, and organize task backlogs.
          </p>
        </div>
      </div>

      {/* Actions and User profile area */}
      <div className="flex items-center justify-end gap-3.5 self-end sm:self-auto w-full sm:w-auto">
        {/* Notification Bell */}
        <button
          type="button"
          className="relative p-2.5 text-foreground/45 hover:text-foreground hover:bg-muted rounded-xl border border-border/20 transition-all duration-150"
          aria-label="View notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-3.5 pl-1.5 border-l border-border/40">
          <div
            title={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`}
            className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/20 text-primary font-bold text-xs flex items-center justify-center cursor-pointer hover:bg-primary/25 transition-colors"
          >
            {getInitials()}
          </div>
          <div className="hidden md:block text-left">
            <span className="block text-xs font-semibold text-foreground leading-none">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="block text-[10px] text-foreground/45 font-medium mt-0.5 leading-none capitalize">
              {user?.role?.toLowerCase()}
            </span>
          </div>
        </div>

        {/* Primary CTA */}
        {canCreate && (
          <Button
            onClick={onCreateTaskClick}
            className="rounded-xl h-10 px-4 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold text-xs shadow-md shadow-primary/10 flex items-center gap-2 transition-all duration-150"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Create Task</span>
          </Button>
        )}
      </div>
    </div>
  );
}
