import { Inbox } from 'lucide-react';

interface EmptyColumnProps {
  className?: string;
  onCreateTask?: () => void;
  showCreateButton?: boolean;
}

export function EmptyColumn({
  className = '',
  onCreateTask,
  showCreateButton = false,
}: EmptyColumnProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/40 rounded-xl bg-muted/10 text-center min-h-[160px] transition-colors duration-200 ${className}`}
    >
      <div className="p-3 bg-muted/30 dark:bg-muted/20 text-foreground/40 rounded-full mb-3">
        <Inbox className="h-5 w-5 stroke-[1.5]" />
      </div>
      <h5 className="text-xs font-semibold text-foreground/70 mb-1">No tasks yet</h5>
      <p className="text-[11px] text-foreground/45 max-w-[200px] leading-normal mb-3">
        Drag tasks here or start by creating a new task.
      </p>
      {showCreateButton && onCreateTask && (
        <button
          onClick={onCreateTask}
          type="button"
          className="inline-flex items-center justify-center text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Create Task
        </button>
      )}
    </div>
  );
}
