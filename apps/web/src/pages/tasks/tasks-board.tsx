import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import { TaskDetailsDrawer } from '../../components/tasks/task-details-drawer';
import { BoardHeader } from '../../components/tasks/board-header';
import { BoardStats } from '../../components/tasks/board-stats';
import { TaskFilters } from '../../components/tasks/task-filters';
import { TaskColumn } from '../../components/tasks/task-column';
import { TaskCard } from '../../components/tasks/task-card';
import { EmptyColumn } from '../../components/tasks/empty-column';
import { CreateTaskModal } from '../../components/tasks/create-task-modal';
import type { Task, Project, AuthUser, TaskLabel } from '@clientflow/types';

const COLUMNS = [
  { id: 'TODO', label: 'To Do' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'REVIEW', label: 'In Review' },
  { id: 'COMPLETED', label: 'Done' },
];

interface TasksBoardProps {
  projectId?: string; // Optional scoping
}

export function TasksBoard({ projectId: scopedProjectId }: TasksBoardProps) {
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [team, setTeam] = useState<AuthUser[]>([]);
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState(scopedProjectId || 'ALL');
  const [assigneeId, setAssigneeId] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [labelId, setLabelId] = useState('ALL');

  // Modals / Drawer State
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalDefaultStatus, setCreateModalDefaultStatus] = useState<string>('TODO');

  const creatableProjects = projects.filter((project) => {
    if (user?.role === 'ADMIN') return true;
    const projectRole = project.projectMembers?.find(
      (member) => member.userId === user?.id,
    )?.projectRole;
    return projectRole === 'PROJECT_MANAGER' || projectRole === 'LEAD_DEVELOPER';
  });
  const activeProjectId = scopedProjectId || projectId;
  const canCreateTasks =
    user?.role === 'ADMIN' ||
    (activeProjectId === 'ALL'
      ? creatableProjects.length > 0
      : creatableProjects.some((project) => project.id === activeProjectId));

  const loadFilterOptions = async () => {
    try {
      const [prjRes, usrRes, lblRes] = await Promise.all([
        api.get('/projects?limit=1000'),
        api.get('/users/staff'),
        api.get('/labels'),
      ]);
      setProjects(prjRes.data.data?.items ?? []);
      setTeam((usrRes.data.data?.users ?? []).filter((u: AuthUser) => u.role !== 'CLIENT'));
      setLabels(lblRes.data.data ?? []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const qParams = new URLSearchParams({
        projectId: scopedProjectId || projectId,
        assigneeId,
        labelId,
        priority,
        search,
      });
      const res = await api.get(`/tasks?${qParams.toString()}`);
      setTasks(res.data.data ?? []);
    } catch (err) {
      notify({ type: 'error', title: 'Error loading tasks', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [projectId, assigneeId, priority, labelId, scopedProjectId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTasks();
  };

  const handleClearFilters = () => {
    setSearch('');
    setProjectId(scopedProjectId || 'ALL');
    setAssigneeId('ALL');
    setPriority('ALL');
    setLabelId('ALL');
    // Force tasks reload after state clears
    setTimeout(() => {
      loadTasks();
    }, 0);
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow drop
  };

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const taskToMove = tasks.find((t) => t.id === taskId);
    if (!taskToMove || taskToMove.status === status) return;

    // Optimistic UI updates
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));

    try {
      await api.patch(`/tasks/${taskId}/move`, { status });
      notify({ type: 'success', title: 'Task position saved' });
      loadTasks();
    } catch (err) {
      notify({ type: 'error', title: 'Drop Failed', message: errorMessage(err) });
      loadTasks(); // rollback
    }
  };

  const handleColumnQuickAdd = (statusId: string) => {
    setCreateModalDefaultStatus(statusId);
    setIsCreateModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 h-full flex-1 w-full min-w-0 overflow-hidden">
      {/* Header section */}
      <BoardHeader
        onCreateTaskClick={() => handleColumnQuickAdd('TODO')}
        canCreate={canCreateTasks}
      />

      {/* Filters (only show if not scoped to project detail workspace) */}
      {!scopedProjectId && (
        <TaskFilters
          search={search}
          setSearch={setSearch}
          projectId={projectId}
          setProjectId={setProjectId}
          assigneeId={assigneeId}
          setAssigneeId={setAssigneeId}
          priority={priority}
          setPriority={setPriority}
          labelId={labelId}
          setLabelId={setLabelId}
          projects={projects}
          team={team}
          labels={labels}
          onSearchSubmit={handleSearchSubmit}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Kanban Board Container */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] bg-card/25 border border-border/40 rounded-2xl gap-3">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-foreground/50 font-medium">Fetching board tasks...</span>
        </div>
      ) : (
        <div className="flex gap-4.5 overflow-x-auto pb-5 select-none items-start min-h-[580px] max-w-full scrollbar-thin">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <TaskColumn
                key={col.id}
                statusId={col.id}
                label={col.label}
                count={colTasks.length}
                canCreate={canCreateTasks}
                onQuickAddClick={() => handleColumnQuickAdd(col.id)}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {colTasks.length === 0 ? (
                  <EmptyColumn
                    showCreateButton={canCreateTasks}
                    onCreateTask={() => handleColumnQuickAdd(col.id)}
                  />
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTaskId(task.id)}
                      onDragStart={handleDragStart}
                      scopedProjectId={scopedProjectId}
                    />
                  ))
                )}
              </TaskColumn>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadTasks}
        projects={creatableProjects}
        defaultStatus={createModalDefaultStatus}
        defaultProjectId={scopedProjectId || (creatableProjects[0]?.id ?? '')}
      />

      {/* Task Drawer details */}
      {selectedTaskId && (
        <TaskDetailsDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={loadTasks}
        />
      )}
    </div>
  );
}
