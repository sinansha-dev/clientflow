import React, { useState } from 'react';
import { ColumnHeader } from './column-header';

interface TaskColumnProps {
  statusId: string;
  label: string;
  count: number;
  canCreate?: boolean;
  onQuickAddClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, statusId: string) => void;
  children: React.ReactNode;
}

export function TaskColumn({
  statusId,
  label,
  count,
  canCreate = false,
  onQuickAddClick,
  onDragOver,
  onDrop,
  children,
}: TaskColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(e);
  };

  const handleDragEnter = () => {
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDropLocal = (e: React.DragEvent) => {
    setIsDragOver(false);
    onDrop(e, statusId);
  };

  // Border colors matching SaaS statuses
  const getTopBorderColor = (id: string) => {
    switch (id) {
      case 'BACKLOG':
        return 'border-t-slate-400 dark:border-t-slate-500/80';
      case 'TODO':
        return 'border-t-blue-500 dark:border-t-blue-500/85';
      case 'IN_PROGRESS':
        return 'border-t-amber-500 dark:border-t-amber-500/85';
      case 'REVIEW':
        return 'border-t-purple-500 dark:border-t-purple-500/85';
      case 'TESTING':
        return 'border-t-indigo-500 dark:border-t-indigo-500/85';
      case 'BLOCKED':
        return 'border-t-red-500 dark:border-t-red-500/85';
      case 'COMPLETED':
      case 'DONE':
        return 'border-t-emerald-500 dark:border-t-emerald-500/85';
      default:
        return 'border-t-border';
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDropLocal}
      className={`flex w-[350px] shrink-0 flex-col rounded-2xl border-t-[3px] border-x border-b border-border/40 p-4 transition-all duration-200 min-h-[480px] max-h-[75vh] ${getTopBorderColor(
        statusId,
      )} ${
        isDragOver
          ? 'bg-muted/30 dark:bg-muted/15 border-primary/30 shadow-md ring-1 ring-primary/10'
          : 'bg-muted/10 dark:bg-card/25'
      }`}
    >
      {/* Column Header */}
      <ColumnHeader
        statusId={statusId}
        label={label}
        count={count}
        canCreate={canCreate}
        onQuickAddClick={onQuickAddClick}
      />

      {/* Column Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 scrollbar-thin max-h-[64vh]">
        {children}
      </div>
    </div>
  );
}
