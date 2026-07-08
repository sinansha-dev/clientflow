import { motion } from 'framer-motion';
import { Calendar, CheckSquare, MessageSquare, Paperclip, Clock, AlertCircle } from 'lucide-react';
import { PriorityBadge } from './priority-badge';
import { TaskProgress } from './task-progress';
import type { Task } from '@clientflow/types';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  scopedProjectId?: string | undefined;
}

export function TaskCard({ task, onClick, onDragStart, scopedProjectId }: TaskCardProps) {
  const completedChecklist = task.checklist?.filter((item) => item.completed).length ?? 0;
  const totalChecklist = task.checklist?.length ?? 0;
  const commentsCount = task.comments?.length ?? 0;
  const attachmentsCount = task.attachments?.length ?? 0;

  // Format due date
  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED';
  const formattedDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

  // Get first letter of assignee name for avatar placeholder
  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase() || '?';
  };

  const projectCode = task.project?.projectCode;

  return (
    <motion.div
      layout
      whileHover={{ y: -3, scale: 1.015 }}
      whileTap={{ scale: 0.985, rotate: 0.5 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      draggable
      onDragStart={(e: any) => onDragStart(e, task.id)}
      onClick={onClick}
      className="group bg-card hover:bg-card/90 border border-border/70 hover:border-primary/45 rounded-xl p-3.5 shadow-sm hover:shadow-lg transition-shadow duration-200 cursor-grab active:cursor-grabbing flex flex-col gap-3"
      style={{ contentVisibility: 'auto' }}
    >
      {/* Top row: Project ID & Priority */}
      <div className="flex items-center justify-between gap-2">
        {!scopedProjectId && projectCode && (
          <span className="text-[10px] font-bold text-primary font-mono tracking-wider uppercase">
            {projectCode}
          </span>
        )}
        <PriorityBadge priority={task.priority as Task['priority']} />
      </div>

      {/* Title and description */}
      <div className="space-y-1">
        <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors leading-snug break-words">
          {task.title}
        </h4>
        {task.description && (
          <p className="text-[11px] text-foreground/50 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Task labels (if any exist) */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="text-[9px] font-semibold px-2 py-0.5 rounded bg-muted/65 text-foreground/60 border border-border/30"
              style={{
                borderColor: label.color ? `${label.color}33` : undefined,
                color: label.color || undefined,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Progress Bar (if checklists exist) */}
      {totalChecklist > 0 && (
        <TaskProgress completed={completedChecklist} total={totalChecklist} className="pt-1" />
      )}

      {/* Divider */}
      <div className="border-t border-border/30 my-0.5" />

      {/* Bottom Row: Stats & Assignees */}
      <div className="flex items-center justify-between text-[11px] text-foreground/45">
        <div className="flex items-center gap-3">
          {/* Due date */}
          {formattedDate && (
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[10px] border ${
                isOverdue
                  ? 'bg-red-500/10 text-red-500 border-red-500/20 dark:border-red-500/30'
                  : 'bg-muted/40 text-foreground/50 border-border/20'
              }`}
              title={isOverdue ? 'Overdue task!' : 'Due date'}
            >
              {isOverdue ? (
                <AlertCircle className="h-3 w-3 shrink-0" />
              ) : (
                <Calendar className="h-3 w-3 shrink-0" />
              )}
              <span>{formattedDate}</span>
            </div>
          )}

          {/* Comment icon + count */}
          {commentsCount > 0 && (
            <div className="flex items-center gap-1.5" title="Discussion">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{commentsCount}</span>
            </div>
          )}

          {/* Attachment icon + count */}
          {attachmentsCount > 0 && (
            <div className="flex items-center gap-1.5" title="Attachments">
              <Paperclip className="h-3.5 w-3.5" />
              <span>{attachmentsCount}</span>
            </div>
          )}
        </div>

        {/* Assignees avatars list */}
        <div className="flex -space-x-1.5 overflow-hidden">
          {task.assignees?.map((a) => (
            <div
              key={a.id}
              title={`${a.firstName} ${a.lastName}`}
              className="inline-block h-6 w-6 rounded-full border border-card bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary transition-colors cursor-pointer"
            >
              {getInitials(a.firstName, a.lastName)}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
