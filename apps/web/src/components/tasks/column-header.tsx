import {
  Plus,
  MoreHorizontal,
  Circle,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Eye,
  Inbox,
} from 'lucide-react';

interface ColumnHeaderProps {
  statusId: string;
  label: string;
  count: number;
  isAdmin?: boolean;
  onQuickAddClick?: () => void;
}

export function ColumnHeader({
  statusId,
  label,
  count,
  isAdmin = false,
  onQuickAddClick,
}: ColumnHeaderProps) {
  // Get icon and color specific to status
  const getStatusConfig = (id: string) => {
    switch (id) {
      case 'BACKLOG':
        return {
          icon: Inbox,
          color: 'text-slate-400 bg-slate-400/10',
          borderColor: 'border-t-slate-400 dark:border-t-slate-500',
        };
      case 'TODO':
        return {
          icon: Circle,
          color: 'text-blue-500 bg-blue-500/10',
          borderColor: 'border-t-blue-400 dark:border-t-blue-500',
        };
      case 'IN_PROGRESS':
        return {
          icon: Clock,
          color: 'text-amber-500 bg-amber-500/10',
          borderColor: 'border-t-amber-400 dark:border-t-amber-500',
        };
      case 'REVIEW':
        return {
          icon: Eye,
          color: 'text-purple-500 bg-purple-500/10',
          borderColor: 'border-t-purple-400 dark:border-t-purple-500',
        };
      case 'TESTING':
        return {
          icon: HelpCircle,
          color: 'text-indigo-500 bg-indigo-500/10',
          borderColor: 'border-t-indigo-400 dark:border-t-indigo-500',
        };
      case 'BLOCKED':
        return {
          icon: AlertCircle,
          color: 'text-red-500 bg-red-500/10',
          borderColor: 'border-t-red-400 dark:border-t-red-500',
        };
      case 'COMPLETED':
      case 'DONE':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-500 bg-emerald-500/10',
          borderColor: 'border-t-emerald-400 dark:border-t-emerald-500',
        };
      default:
        return {
          icon: Circle,
          color: 'text-slate-400 bg-slate-400/10',
          borderColor: 'border-t-slate-400',
        };
    }
  };

  const config = getStatusConfig(statusId);
  const StatusIcon = config.icon;

  return (
    <div className="flex items-center justify-between py-2 mb-3 select-none">
      <div className="flex items-center gap-2">
        <div className={`p-1 rounded-md ${config.color}`}>
          <StatusIcon className="h-3.5 w-3.5" />
        </div>
        <span className="font-semibold text-xs text-foreground/80 tracking-wide">{label}</span>
        <span className="bg-muted dark:bg-muted/70 text-foreground/50 border border-border/20 px-2 py-0.5 text-[10px] font-bold rounded-full">
          {count}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {isAdmin && onQuickAddClick && (
          <button
            onClick={onQuickAddClick}
            type="button"
            className="p-1 hover:bg-muted text-foreground/45 hover:text-foreground rounded-lg transition-colors duration-150"
            aria-label="Add Task to Column"
            title="Create task in this column"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          className="p-1 hover:bg-muted text-foreground/45 hover:text-foreground rounded-lg transition-colors duration-150"
          aria-label="Column Actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
