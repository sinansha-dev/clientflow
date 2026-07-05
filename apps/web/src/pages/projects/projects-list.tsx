import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import { ProjectWizard } from '../../components/projects/project-wizard';
import type { Project, Client, AuthUser } from '@clientflow/types';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Plus,
  Search,
  Trash2,
  Archive,
  FolderOpen,
  RotateCcw,
} from 'lucide-react';

export function ProjectsListPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [health, setHealth] = useState('ALL');
  const [clientId, setClientId] = useState('ALL');
  const [managerId, setManagerId] = useState('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter collections
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<AuthUser[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Load clients and managers for filter selections
  useEffect(() => {
    async function loadOptions() {
      try {
        const [cliRes, mgrRes] = await Promise.all([
          api.get('/clients?limit=1000'),
          api.get('/users'),
        ]);
        setClients(cliRes.data.data?.items ?? []);
        setManagers((mgrRes.data.data ?? []).filter((u: AuthUser) => u.role !== 'CLIENT'));
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    }
    loadOptions();
  }, []);

  const loadProjects = async () => {
    try {
      const qParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
        ...(search ? { search } : {}),
        ...(status !== 'ALL' ? { status } : {}),
        ...(priority !== 'ALL' ? { priority } : {}),
        ...(health !== 'ALL' ? { health } : {}),
        ...(clientId !== 'ALL' ? { clientId } : {}),
        ...(managerId !== 'ALL' ? { managerId } : {}),
      });

      const response = await api.get(`/projects?${qParams.toString()}`);
      const data = response.data.data;
      setProjects(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      notify({
        type: 'error',
        title: 'Error Loading Projects',
        message: errorMessage(err, 'Failed to fetch projects list'),
      });
    }
  };

  useEffect(() => {
    loadProjects();
  }, [page, status, priority, health, clientId, managerId, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadProjects();
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(projects.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to archive ${selectedIds.length} projects?`)) return;

    try {
      await Promise.all(selectedIds.map((id) => api.post(`/projects/${id}/archive`)));
      notify({
        type: 'success',
        title: 'Bulk Archive Successful',
        message: `${selectedIds.length} projects archived`,
      });
      setSelectedIds([]);
      loadProjects();
    } catch (err) {
      notify({ type: 'error', title: 'Action Failed', message: errorMessage(err) });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} projects?`)) return;

    try {
      await Promise.all(selectedIds.map((id) => api.delete(`/projects/${id}`)));
      notify({
        type: 'success',
        title: 'Bulk Delete Successful',
        message: `${selectedIds.length} projects deleted`,
      });
      setSelectedIds([]);
      loadProjects();
    } catch (err) {
      notify({ type: 'error', title: 'Action Failed', message: errorMessage(err) });
    }
  };

  // CSV Export
  const exportToCSV = () => {
    const headers = [
      'Project Code',
      'Project Name',
      'Client',
      'Status',
      'Priority',
      'Health',
      'Budget',
      'Progress',
      'Deadline',
    ];
    const rows = projects.map((p) => [
      p.projectCode,
      p.projectName,
      p.client?.companyName ?? 'N/A',
      p.status,
      p.priority,
      p.healthStatus,
      p.budget,
      `${p.progress}%`,
      new Date(p.deadline).toLocaleDateString(),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [
        headers.join(','),
        ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'clientflow_projects.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="grid gap-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Track and manage your client deliverables, timelines, and milestones.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={exportToCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          {isAdmin && (
            <Button onClick={() => setShowWizard(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create Project
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Actions Banner */}
      {selectedIds.length > 0 && isAdmin && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-semibold">{selectedIds.length} projects selected</span>
          <Button
            variant="ghost"
            onClick={handleBulkArchive}
            className="flex items-center gap-1.5 text-orange-500 hover:bg-orange-500/10 h-8 px-2.5 text-xs"
          >
            <Archive className="h-3.5 w-3.5" /> Complete / Archive
          </Button>
          <Button
            variant="ghost"
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 text-danger hover:bg-danger/10 h-8 px-2.5 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="flex flex-col gap-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project name, code, client, manager..."
              className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button type="submit">Search</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" /> Filters{' '}
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </form>

        {showFilters && (
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1">
              <label className="text-xs font-semibold text-foreground/60">Status</label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              >
                <option value="ALL">All Statuses</option>
                <option value="PLANNING">Planning</option>
                <option value="DEVELOPMENT">Development</option>
                <option value="TESTING">Testing</option>
                <option value="CLIENT_REVIEW">Client Review</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-semibold text-foreground/60">Priority</label>
              <select
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              >
                <option value="ALL">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-semibold text-foreground/60">Health</label>
              <select
                value={health}
                onChange={(e) => {
                  setHealth(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              >
                <option value="ALL">All Healths</option>
                <option value="HEALTHY">Healthy</option>
                <option value="AT_RISK">At Risk</option>
                <option value="DELAYED">Delayed</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-semibold text-foreground/60">Client</label>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              >
                <option value="ALL">All Clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Card>

      {/* Projects Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 font-semibold text-foreground/80">
                {isAdmin && (
                  <th className="px-6 py-4 w-12">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={projects.length > 0 && selectedIds.length === projects.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                )}
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4 cursor-pointer" onClick={() => toggleSort('clientId')}>
                  <div className="flex items-center gap-1">
                    Client {sortBy === 'clientId' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="px-6 py-4">Status & Priority</th>
                <th className="px-6 py-4">Progress</th>
                <th className="px-6 py-4 cursor-pointer" onClick={() => toggleSort('budget')}>
                  <div className="flex items-center gap-1">
                    Budget {sortBy === 'budget' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer" onClick={() => toggleSort('deadline')}>
                  <div className="flex items-center gap-1">
                    Deadline {sortBy === 'deadline' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="px-6 py-4">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 7}
                    className="px-6 py-12 text-center text-foreground/50"
                  >
                    No projects found.
                  </td>
                </tr>
              ) : (
                projects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="cursor-pointer hover:bg-muted/40 transition"
                  >
                    {isAdmin && (
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={selectedIds.includes(p.id)}
                          onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-semibold text-foreground hover:text-primary transition">
                          {p.projectName}
                        </span>
                        <span className="block text-xs text-foreground/50 font-mono mt-0.5">
                          {p.projectCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">{p.client?.companyName}</td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded text-foreground/80">
                          {p.status.replace('_', ' ')}
                        </span>
                        <span
                          className={`block text-[10px] font-bold mt-1 uppercase tracking-wider ${
                            p.priority === 'CRITICAL'
                              ? 'text-danger'
                              : p.priority === 'HIGH'
                                ? 'text-orange-500'
                                : p.priority === 'MEDIUM'
                                  ? 'text-primary'
                                  : 'text-foreground/50'
                          }`}
                        >
                          {p.priority} Priority
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 w-44">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold">${p.budget.toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs text-foreground/60">
                      {new Date(p.deadline).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                          p.healthStatus === 'HEALTHY'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : p.healthStatus === 'AT_RISK'
                              ? 'bg-orange-500/10 text-orange-600'
                              : 'bg-danger/10 text-danger'
                        }`}
                      >
                        {p.healthStatus.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <span className="text-xs text-foreground/50">
              Showing page {page} of {totalPages} ({total} total projects)
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="h-8 px-2.5 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="h-8 px-2.5 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Project Creation Wizard Modal */}
      {showWizard && (
        <ProjectWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            loadProjects();
            setSelectedIds([]);
          }}
        />
      )}
    </div>
  );
}
