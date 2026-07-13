import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import type {
  Task,
  TaskComment,
  TaskChecklist,
  TaskAttachment,
  TaskLabel,
  TaskActivity,
  AuthUser,
  Project,
} from '@clientflow/types';
import {
  Calendar,
  CheckSquare,
  Clock,
  MessageSquare,
  Paperclip,
  Plus,
  Shield,
  Tag,
  Trash2,
  Upload,
  User,
  X,
  Eye,
  CheckCircle,
} from 'lucide-react';

interface TaskDetailsDrawerProps {
  taskId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function TaskDetailsDrawer({ taskId, onClose, onUpdate }: TaskDetailsDrawerProps) {
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  // Assignees options
  const [projectTeam, setProjectTeam] = useState<AuthUser[]>([]);
  const [allLabels, setAllLabels] = useState<TaskLabel[]>([]);

  // Subresource states
  const [newComment, setNewComment] = useState('');
  const [newChecklist, setNewChecklist] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Attachment upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Edit fields state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState('');

  const loadTask = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/tasks/${taskId}`);
      const t = res.data.data as Task;
      setTask(t);
      setTitleInput(t.title);
      setDescInput(t.description ?? '');

      // Load project team members (isolated so it doesn't crash the drawer if the project is deleted)
      try {
        if (t.projectId) {
          const prjRes = await api.get(`/projects/${t.projectId}`);
          const prj = prjRes.data.data;
          setProjectTeam(prj?.projectMembers?.map((tm: any) => tm.user) ?? []);
        }
      } catch (err) {
        console.error('Failed to load project details or team members:', err);
      }

      // Load all labels
      const labelsRes = await api.get('/labels');
      setAllLabels(labelsRes.data.data ?? []);
    } catch (err) {
      notify({ type: 'error', title: 'Load Failed', message: errorMessage(err) });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTask();
  }, [taskId]);

  if (loading || !task) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card border-l border-border p-6 shadow-2xl flex items-center justify-center">
        <span>Loading task details...</span>
      </div>
    );
  }

  const isAssigned = task.assignees?.some((assignee) => assignee.id === user?.id);
  const projectRole = task.project?.projectMembers?.find(
    (member) => member.userId === user?.id,
  )?.projectRole;
  const canModifyConfig =
    user?.role === 'ADMIN' || projectRole === 'PROJECT_MANAGER' || projectRole === 'LEAD_DEVELOPER';
  const canUpdateProgress = canModifyConfig || Boolean(isAssigned);

  // --- Task Detail Mutators ---
  const handleDeleteTask = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      notify({
        type: 'success',
        title: 'Task Deleted',
        message: 'Task was deleted successfully',
      });
      onUpdate();
      onClose();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Delete Failed',
        message: errorMessage(err, 'Failed to delete task'),
      });
    }
  };

  const updateTaskField = async (
    fields: Partial<Task> & { assigneeIds?: string[]; labelIds?: string[] },
  ) => {
    try {
      const res = await api.patch(`/tasks/${taskId}`, fields);
      setTask((prev) => ({ ...prev!, ...res.data.data }));
      onUpdate();
    } catch (err) {
      notify({ type: 'error', title: 'Update Failed', message: errorMessage(err) });
    }
  };

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (titleInput.trim() && titleInput !== task.title) {
      updateTaskField({ title: titleInput });
    }
  };

  const handleDescBlur = () => {
    setEditingDesc(false);
    if (descInput !== task.description) {
      updateTaskField({ description: descInput });
    }
  };

  // Assignee toggles
  const toggleAssignee = (userId: string) => {
    if (!canModifyConfig) return;
    const currentIds = task.assignees?.map((a) => a.id) ?? [];
    const newIds = currentIds.includes(userId)
      ? currentIds.filter((id) => id !== userId)
      : [...currentIds, userId];
    updateTaskField({ assigneeIds: newIds });
  };

  // Label toggles
  const toggleLabel = (labelId: string) => {
    if (!canModifyConfig) return;
    const currentIds = task.labels?.map((l) => l.id) ?? [];
    const newIds = currentIds.includes(labelId)
      ? currentIds.filter((id) => id !== labelId)
      : [...currentIds, labelId];
    updateTaskField({ labelIds: newIds });
  };

  // --- Comments Actions ---
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await api.post(`/tasks/${taskId}/comments`, { comment: newComment });
      setNewComment('');
      loadTask();
    } catch (err) {
      notify({ type: 'error', title: 'Post Failed', message: errorMessage(err) });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.delete(`/tasks/comments/${commentId}`);
      loadTask();
    } catch (err) {
      notify({ type: 'error', title: 'Delete Failed', message: errorMessage(err) });
    }
  };

  // --- Checklist Actions ---
  const handleChecklistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklist.trim()) return;

    try {
      await api.post(`/tasks/${taskId}/checklists`, { title: newChecklist });
      setNewChecklist('');
      loadTask();
    } catch (err) {
      notify({ type: 'error', title: 'Failed to Add', message: errorMessage(err) });
    }
  };

  const toggleChecklistItem = async (id: string, completed: boolean) => {
    try {
      await api.patch(`/tasks/checklists/${id}`, { completed });
      loadTask();
    } catch (err) {
      notify({ type: 'error', title: 'Action Failed', message: errorMessage(err) });
    }
  };

  const handleDeleteChecklistItem = async (id: string) => {
    try {
      await api.delete(`/tasks/checklists/${id}`);
      loadTask();
    } catch (err) {
      notify({ type: 'error', title: 'Delete Failed', message: errorMessage(err) });
    }
  };

  // --- Subtask Actions ---
  const handleSubtaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    try {
      await api.post('/tasks', {
        projectId: task.projectId,
        parentTaskId: task.id,
        title: newSubtaskTitle,
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
      });
      setNewSubtaskTitle('');
      loadTask();
    } catch (err) {
      notify({ type: 'error', title: 'Failed to Add Subtask', message: errorMessage(err) });
    }
  };

  const handleSubtaskStatusToggle = async (sub: Task) => {
    try {
      const nextStatus = sub.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
      await api.patch(`/tasks/${sub.id}`, { status: nextStatus });
      loadTask();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Attachments Actions ---
  const triggerAttachmentUpload = () => {
    fileInputRef.current?.click();
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      await api.post(`/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify({ type: 'success', title: 'Attachment Uploaded' });
      loadTask();
    } catch (err) {
      notify({ type: 'error', title: 'Upload Failed', message: errorMessage(err) });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!window.confirm('Delete this file attachment?')) return;
    try {
      await api.delete(`/tasks/attachments/${attachmentId}`);
      loadTask();
    } catch (err) {
      notify({ type: 'error', title: 'Delete Failed', message: errorMessage(err) });
    }
  };

  // Subtask progress calculations
  const totalSubtasks = task.subtasks?.length ?? 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.status === 'COMPLETED').length ?? 0;
  const subtaskProgress =
    totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Checklist calculations
  const totalCheck = task.checklist?.length ?? 0;
  const completedCheck = task.checklist?.filter((c) => c.completed).length ?? 0;
  const checklistProgress = totalCheck > 0 ? Math.round((completedCheck / totalCheck) * 100) : 0;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-xl flex-col bg-card shadow-2xl border-l border-border transition-all duration-300">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" />
          <span className="text-xs font-mono font-semibold text-foreground/50">
            Task details &bull; {task.project?.projectCode || 'No Project'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {user?.role === 'ADMIN' && (
            <button
              onClick={handleDeleteTask}
              className="rounded-md p-1.5 text-foreground/50 hover:bg-danger/10 hover:text-danger"
              aria-label="Delete task"
              title="Delete task"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-foreground/50 hover:bg-muted hover:text-foreground"
            aria-label="Close details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Drawer Scroll Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Title */}
        <div className="space-y-1">
          {editingTitle && canModifyConfig ? (
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              className="w-full text-lg font-bold bg-background border border-primary px-2.5 py-1 rounded outline-none"
              autoFocus
            />
          ) : (
            <h2
              onClick={() => canModifyConfig && setEditingTitle(true)}
              className={`text-lg font-bold text-foreground ${canModifyConfig ? 'cursor-pointer hover:bg-muted/40 rounded p-1' : ''}`}
            >
              {task.title}
            </h2>
          )}
        </div>

        {/* Config Parameters Panel (Status, priority, PM etc) */}
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/20 border border-border/40 p-4 text-xs">
          <div className="space-y-1">
            <span className="text-foreground/50 block font-semibold uppercase tracking-wider">
              Status
            </span>
            <select
              value={task.status}
              onChange={(e) => updateTaskField({ status: e.target.value })}
              className="h-8 w-full rounded border border-border bg-background px-2"
              disabled={!canUpdateProgress}
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REVIEW">Review</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-foreground/50 block font-semibold uppercase tracking-wider">
              Priority
            </span>
            <select
              value={task.priority}
              onChange={(e) => updateTaskField({ priority: e.target.value })}
              className="h-8 w-full rounded border border-border bg-background px-2"
              disabled={!canModifyConfig}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-foreground/50 block font-semibold uppercase tracking-wider">
              Due Date
            </span>
            <input
              type="date"
              value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
              onChange={(e) => updateTaskField({ dueDate: e.target.value || null })}
              className="h-8 w-full rounded border border-border bg-background px-2"
              disabled={!canModifyConfig}
            />
          </div>

          <div className="space-y-1">
            <span className="text-foreground/50 block font-semibold uppercase tracking-wider">
              Estimate (Hrs)
            </span>
            <input
              type="number"
              value={task.estimatedHours}
              onChange={(e) => updateTaskField({ estimatedHours: parseFloat(e.target.value) || 0 })}
              className="h-8 w-full rounded border border-border bg-background px-2"
              disabled={!canModifyConfig}
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">
            Description
          </span>
          {editingDesc && canModifyConfig ? (
            <div className="space-y-2">
              <textarea
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                rows={4}
                className="w-full text-sm bg-background border border-border p-2.5 rounded outline-none"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setEditingDesc(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button onClick={handleDescBlur} className="h-8 text-xs">
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p
              onClick={() => canModifyConfig && setEditingDesc(true)}
              className={`text-sm text-foreground/80 leading-relaxed whitespace-pre-line ${
                canModifyConfig
                  ? 'cursor-pointer hover:bg-muted/40 rounded p-2.5 bg-muted/10 border border-border/20'
                  : ''
              }`}
            >
              {task.description || (
                <span className="italic text-foreground/40">
                  No description provided. Click to add one.
                </span>
              )}
            </p>
          )}
        </div>

        {/* Assignees Selector */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground/50 block">
            Assignees
          </span>
          <div className="flex flex-wrap gap-1">
            {projectTeam.map((member) => {
              const assigned = task.assignees?.some((a) => a.id === member.id);
              return (
                <button
                  key={member.id}
                  onClick={() => toggleAssignee(member.id)}
                  disabled={!canModifyConfig}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition font-medium ${
                    assigned
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground/60 hover:text-foreground'
                  }`}
                  type="button"
                >
                  <div className="h-4.5 w-4.5 rounded-full bg-muted flex items-center justify-center text-[9px]">
                    {member.firstName.charAt(0)}
                  </div>
                  {member.firstName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Labels Selector */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground/50 block">
            Labels
          </span>
          <div className="flex flex-wrap gap-1.5">
            {allLabels.map((l) => {
              const active = task.labels?.some((lbl) => lbl.id === l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => toggleLabel(l.id)}
                  disabled={!canModifyConfig}
                  style={{
                    backgroundColor: active ? `${l.color}15` : 'transparent',
                    borderColor: active ? l.color : 'var(--border)',
                    color: active ? l.color : 'var(--foreground-muted)',
                  }}
                  className="rounded px-2.5 py-0.5 text-xs border font-semibold select-none flex items-center gap-1"
                  type="button"
                >
                  <Tag className="h-3 w-3" /> {l.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold uppercase tracking-wider text-foreground/50">
              Checklist ({checklistProgress}%)
            </span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden mb-2">
            <div className="h-full bg-primary" style={{ width: `${checklistProgress}%` }} />
          </div>

          <form onSubmit={handleChecklistSubmit} className="flex gap-2">
            <input
              type="text"
              value={newChecklist}
              onChange={(e) => setNewChecklist(e.target.value)}
              placeholder="Add checklist item..."
              className="h-9 flex-1 rounded border border-border bg-background px-3 text-xs outline-none focus:border-primary"
            />
            <Button type="submit" className="h-9 px-3 text-xs">
              + Add
            </Button>
          </form>

          <div className="grid gap-2">
            {task.checklist?.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs p-2 bg-muted/20 rounded border border-border/50"
              >
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => toggleChecklistItem(item.id, e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span
                    className={
                      item.completed ? 'line-through text-foreground/50' : 'text-foreground'
                    }
                  >
                    {item.title}
                  </span>
                </label>
                <button
                  onClick={() => handleDeleteChecklistItem(item.id)}
                  className="text-danger hover:bg-danger/10 p-1 rounded"
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Subtasks */}
        <div className="space-y-3">
          <span className="xs font-bold uppercase tracking-wider text-foreground/50 block">
            Subtasks ({subtaskProgress}%)
          </span>

          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden mb-2">
            <div className="h-full bg-primary" style={{ width: `${subtaskProgress}%` }} />
          </div>

          <form onSubmit={handleSubtaskSubmit} className="flex gap-2">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Add child task..."
              className="h-9 flex-1 rounded border border-border bg-background px-3 text-xs outline-none focus:border-primary"
            />
            <Button type="submit" className="h-9 px-3 text-xs">
              + Subtask
            </Button>
          </form>

          <div className="grid gap-2">
            {task.subtasks?.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between text-xs p-2 bg-muted/20 rounded border border-border/50"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSubtaskStatusToggle(sub)}
                    className={`h-4.5 w-4.5 border rounded flex items-center justify-center text-white ${
                      sub.status === 'COMPLETED' ? 'bg-primary border-primary' : 'border-border'
                    }`}
                    type="button"
                  >
                    {sub.status === 'COMPLETED' && '✓'}
                  </button>
                  <span
                    className={
                      sub.status === 'COMPLETED'
                        ? 'line-through text-foreground/50'
                        : 'text-foreground'
                    }
                  >
                    {sub.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attachments */}
        <div className="space-y-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAttachmentUpload}
            className="hidden"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">
              Attachments
            </span>
            <button
              onClick={triggerAttachmentUpload}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              type="button"
              disabled={uploading}
            >
              <Paperclip className="h-3.5 w-3.5" /> Upload File
            </button>
          </div>

          <div className="grid gap-2">
            {task.attachments?.length === 0 ? (
              <span className="text-xs text-foreground/40 italic">No files attached</span>
            ) : (
              task.attachments?.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 text-foreground/45" />
                    <a
                      href={`${api.defaults.baseURL || ''}${att.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:underline text-primary truncate max-w-[240px]"
                    >
                      {att.name}
                    </a>
                  </div>
                  <button
                    onClick={() => handleDeleteAttachment(att.id)}
                    className="text-danger hover:bg-danger/10 p-1 rounded"
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Comments */}
        <div className="space-y-4 pt-2 border-t border-border/60">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground/50 block">
            Discussion
          </span>
          <form onSubmit={handleCommentSubmit} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="h-9 flex-1 rounded border border-border bg-background px-3 text-xs outline-none focus:border-primary"
            />
            <Button type="submit" className="h-9 px-3 text-xs">
              Comment
            </Button>
          </form>

          <div className="grid gap-3">
            {task.comments?.map((comment) => (
              <div
                key={comment.id}
                className="bg-muted/10 p-2.5 rounded border border-border/40 text-xs flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-foreground/50">
                  <span className="font-bold text-foreground/85">
                    {comment.user?.firstName} {comment.user?.lastName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>{new Date(comment.createdAt).toLocaleString()}</span>
                    {comment.userId === user?.id && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-danger hover:underline ml-1"
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-foreground/80">{comment.comment}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activities Timeline */}
        <div className="space-y-3 pt-2 border-t border-border/60">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground/50 block">
            Audit Activity
          </span>
          <div className="relative border-l border-border pl-4 ml-2 flex flex-col gap-4 text-xs">
            {task.activities?.map((act) => (
              <div key={act.id} className="relative">
                <div className="absolute -left-[21px] top-1 bg-background border border-primary h-2 w-2 rounded-full" />
                <div>
                  <span className="block font-semibold text-foreground/80">{act.description}</span>
                  <span className="text-[10px] text-foreground/50">
                    {new Date(act.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
