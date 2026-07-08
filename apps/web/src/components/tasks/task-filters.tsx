import React from 'react';
import { Search, Folder, Users, AlertTriangle, Tag, RefreshCw, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import type { Project, AuthUser, TaskLabel } from '@clientflow/types';

interface TaskFiltersProps {
  search: string;
  setSearch: (val: string) => void;
  projectId: string;
  setProjectId: (val: string) => void;
  assigneeId: string;
  setAssigneeId: (val: string) => void;
  priority: string;
  setPriority: (val: string) => void;
  labelId: string;
  setLabelId: (val: string) => void;
  projects: Project[];
  team: AuthUser[];
  labels: TaskLabel[];
  onSearchSubmit: (e: React.FormEvent) => void;
  onClearFilters: () => void;
}

export function TaskFilters({
  search,
  setSearch,
  projectId,
  setProjectId,
  assigneeId,
  setAssigneeId,
  priority,
  setPriority,
  labelId,
  setLabelId,
  projects,
  team,
  labels,
  onSearchSubmit,
  onClearFilters,
}: TaskFiltersProps) {
  const hasActiveFilters =
    search !== '' ||
    projectId !== 'ALL' ||
    assigneeId !== 'ALL' ||
    priority !== 'ALL' ||
    labelId !== 'ALL';

  return (
    <div className="flex flex-col gap-4 p-6 bg-card border border-border/80 rounded-2xl shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={onSearchSubmit} className="flex gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks by title..."
              className="h-10 w-full rounded-xl border border-border/80 bg-background/50 pl-10 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <Button
            type="submit"
            className="rounded-xl h-10 px-4 bg-primary hover:bg-primary/95 text-primary-foreground text-xs"
          >
            Search
          </Button>
        </form>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            type="button"
            className="flex items-center gap-1.5 text-xs text-foreground/45 hover:text-primary transition-colors font-medium py-1 px-2.5 rounded-lg hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Filters
          </button>
        )}
      </div>

      {/* Selects row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border/40 pt-3.5 text-xs">
        {/* Project Selector */}
        <div className="grid gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
            Project
          </label>
          <div className="relative">
            <Folder className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/35 pointer-events-none" />
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/80 bg-background/50 pl-9 pr-8 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none transition-all"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45 pointer-events-none" />
          </div>
        </div>

        {/* Assignee Selector */}
        <div className="grid gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
            Assignee
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/35 pointer-events-none" />
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/80 bg-background/50 pl-9 pr-8 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none transition-all"
            >
              <option value="ALL">All Assignees</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45 pointer-events-none" />
          </div>
        </div>

        {/* Priority Selector */}
        <div className="grid gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
            Priority
          </label>
          <div className="relative">
            <AlertTriangle className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/35 pointer-events-none" />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/80 bg-background/50 pl-9 pr-8 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none transition-all"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45 pointer-events-none" />
          </div>
        </div>

        {/* Label Selector */}
        <div className="grid gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
            Label
          </label>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/35 pointer-events-none" />
            <select
              value={labelId}
              onChange={(e) => setLabelId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/80 bg-background/50 pl-9 pr-8 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none transition-all"
            >
              <option value="ALL">All Labels</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
