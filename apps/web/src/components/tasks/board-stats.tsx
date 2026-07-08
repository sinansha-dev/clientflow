import { motion } from 'framer-motion';
import {
  ListTodo,
  CheckCircle2,
  Activity,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { Task } from '@clientflow/types';

interface BoardStatsProps {
  tasks: Task[];
}

export function BoardStats({ tasks }: BoardStatsProps) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const overdue = tasks.filter((t) => {
    if (!t.dueDate || t.status === 'COMPLETED') return false;
    return new Date(t.dueDate) < new Date();
  }).length;

  const stats = [
    {
      label: 'Total Tasks',
      value: total,
      icon: ListTodo,
      gradient: 'from-blue-500/5 to-indigo-500/5 dark:from-blue-500/10 dark:to-indigo-500/5',
      borderColor: 'border-blue-500/10 dark:border-blue-500/15',
      iconColor: 'text-blue-500',
      trend: {
        text: 'All items in backlog & board',
        isPositive: true,
      },
    },
    {
      label: 'In Progress',
      value: inProgress,
      icon: Activity,
      gradient: 'from-amber-500/5 to-orange-500/5 dark:from-amber-500/10 dark:to-orange-500/5',
      borderColor: 'border-amber-500/10 dark:border-amber-500/15',
      iconColor: 'text-amber-500',
      trend: {
        text: `${total > 0 ? Math.round((inProgress / total) * 100) : 0}% of total board`,
        isPositive: true,
      },
    },
    {
      label: 'Completed',
      value: completed,
      icon: CheckCircle2,
      gradient: 'from-emerald-500/5 to-teal-500/5 dark:from-emerald-500/10 dark:to-teal-500/5',
      borderColor: 'border-emerald-500/10 dark:border-emerald-500/15',
      iconColor: 'text-emerald-500',
      trend: {
        text: `${total > 0 ? Math.round((completed / total) * 100) : 0}% completion rate`,
        isPositive: true,
      },
    },
    {
      label: 'Overdue',
      value: overdue,
      icon: AlertCircle,
      gradient: 'from-red-500/5 to-rose-500/5 dark:from-red-500/10 dark:to-rose-500/5',
      borderColor: 'border-red-500/10 dark:border-red-500/15',
      iconColor: 'text-red-500',
      trend: {
        text: overdue > 0 ? 'Requires attention' : 'All clear',
        isPositive: overdue === 0,
      },
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
    >
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={idx}
            variants={itemVariants}
            className={`relative flex flex-col justify-between p-4.5 rounded-2xl border ${stat.borderColor} bg-gradient-to-br ${stat.gradient} backdrop-blur-xs`}
          >
            {/* Top Stat Row */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-foreground/45 uppercase tracking-wider">
                {stat.label}
              </span>
              <div
                className={`p-1.5 rounded-lg bg-card border border-border/10 shadow-xs ${stat.iconColor}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>

            {/* Stat Value */}
            <div className="mt-3.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-sans tracking-tight text-foreground">
                {stat.value}
              </span>
            </div>

            {/* Trend Indicator */}
            <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-foreground/40 font-medium">
              {stat.label === 'Overdue' && overdue > 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
              ) : stat.label === 'Completed' && completed > 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <ArrowRightIcon className="h-3.5 w-3.5" />
              )}
              <span
                className={
                  stat.label === 'Overdue' && overdue > 0 ? 'text-red-500 font-semibold' : ''
                }
              >
                {stat.trend.text}
              </span>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// Small arrow right indicator
function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.22 5.08a.75.75 0 1 1 1.06-1.06l5.5 5.5a.75.75 0 0 1 0 1.06l-5.5 5.5a.75.75 0 1 1-1.06-1.06l4.167-4.17H3.75A.75.75 0 0 1 3 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
