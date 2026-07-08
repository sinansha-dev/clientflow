import { AlertOctagon, AlertTriangle, ArrowDown, ArrowRight } from 'lucide-react';
import type { Task } from '@clientflow/types';

interface PriorityBadgeProps {
  priority: Task['priority'];
  className?: string;
}

export function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  const getPriorityStyles = () => {
    switch (priority) {
      case 'CRITICAL':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/15',
          text: 'text-red-600 dark:text-red-400',
          border: 'border-red-500/20 dark:border-red-500/30',
          icon: AlertOctagon,
          label: 'Critical',
        };
      case 'HIGH':
        return {
          bg: 'bg-orange-500/10 dark:bg-orange-500/15',
          text: 'text-orange-600 dark:text-orange-400',
          border: 'border-orange-500/20 dark:border-orange-500/30',
          icon: AlertTriangle,
          label: 'High',
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/15',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-500/20 dark:border-amber-500/30',
          icon: ArrowRight,
          label: 'Medium',
        };
      case 'LOW':
      default:
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-500/15',
          text: 'text-blue-600 dark:text-blue-400',
          border: 'border-blue-500/20 dark:border-blue-500/30',
          icon: ArrowDown,
          label: 'Low',
        };
    }
  };

  const styles = getPriorityStyles();
  const Icon = styles.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles.bg} ${styles.text} ${styles.border} ${className}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{styles.label}</span>
    </span>
  );
}
