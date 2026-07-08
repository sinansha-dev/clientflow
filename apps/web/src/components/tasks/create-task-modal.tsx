import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Plus, ChevronDown, ListTodo, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { api } from '../../lib/api';
import { useToastStore } from '../../stores/toast-store';
import { errorMessage } from '../../lib/errors';
import type { Project } from '@clientflow/types';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projects: Project[];
  defaultStatus?: string;
  defaultProjectId?: string;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSuccess,
  projects,
  defaultStatus = 'TODO',
  defaultProjectId = '',
}: CreateTaskModalProps) {
  const notify = useToastStore((state) => state.notify);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    projectId: defaultProjectId,
    title: '',
    description: '',
    status: defaultStatus,
    priority: 'MEDIUM',
    dueDate: '',
  });

  // Ensure default values are populated when modal opens or defaults change
  useEffect(() => {
    setForm({
      projectId: defaultProjectId || (projects[0]?.id ?? ''),
      title: '',
      description: '',
      status: defaultStatus,
      priority: 'MEDIUM',
      dueDate: '',
    });
  }, [isOpen, defaultStatus, defaultProjectId, projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectId) {
      notify({
        type: 'error',
        title: 'Validation Error',
        message: 'Please select a project first.',
      });
      return;
    }
    if (!form.title.trim()) {
      notify({
        type: 'error',
        title: 'Validation Error',
        message: 'Task title is required.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/tasks', form);
      notify({ type: 'success', title: 'Task Created Successfully' });
      onSuccess();
      onClose();
    } catch (err) {
      notify({ type: 'error', title: 'Create Failed', message: errorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative w-full max-w-xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden z-10"
          >
            {/* Top glowing line */}
            <div className="h-1 w-full bg-gradient-to-r from-primary via-indigo-500 to-purple-500" />

            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <ListTodo className="h-5 w-5 text-primary" />
                    Create New Task
                  </h3>
                  <p className="text-xs text-foreground/50 mt-0.5">
                    Fill in the details to add a new task to your workspace.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-muted text-foreground/50 hover:text-foreground rounded-lg transition-colors duration-150"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                {/* Project selector */}
                <div className="grid gap-1.5">
                  <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
                    Project
                  </label>
                  <div className="relative">
                    <select
                      value={form.projectId}
                      onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                      className="h-10 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none transition-all"
                      required
                    >
                      <option value="" disabled>
                        Select a project
                      </option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.projectName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45 pointer-events-none" />
                  </div>
                </div>

                {/* Title */}
                <Input
                  label="Task Title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Design Auth Flow"
                  className="h-10 bg-background/50 border-border/80 focus-visible:ring-2 focus-visible:ring-primary/20 rounded-lg text-xs"
                  required
                  autoFocus
                />

                {/* Description */}
                <div className="grid gap-1.5">
                  <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe what needs to be done..."
                    rows={3}
                    className="w-full rounded-lg border border-border/80 bg-background/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-foreground/30 resize-none transition-all"
                  />
                </div>

                {/* Meta Rows (Status, Priority, Due Date) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Status */}
                  <div className="grid gap-1.5">
                    <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
                      Status
                    </label>
                    <div className="relative">
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="h-10 w-full rounded-lg border border-border/80 bg-background/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none transition-all"
                      >
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="REVIEW">In Review</option>
                        <option value="COMPLETED">Done</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45 pointer-events-none" />
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="grid gap-1.5">
                    <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
                      Priority
                    </label>
                    <div className="relative">
                      <select
                        value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                        className="h-10 w-full rounded-lg border border-border/80 bg-background/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none transition-all"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45 pointer-events-none" />
                    </div>
                  </div>

                  {/* Due Date */}
                  <Input
                    label="Due Date"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="h-10 bg-background/50 border-border/80 focus-visible:ring-2 focus-visible:ring-primary/20 rounded-lg pr-3 text-xs"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40 mt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="rounded-lg h-10 px-4 text-foreground/75 hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg h-10 px-5 bg-primary hover:bg-primary/95 text-primary-foreground shadow-md shadow-primary/10 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      'Creating...'
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create Task
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
