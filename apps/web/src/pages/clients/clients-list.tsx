import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import { ClientWizard } from '../../components/clients/client-wizard';
import type { Client, AuthUser } from '@clientflow/types';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Plus,
  Search,
  Trash2,
  Archive,
  RotateCcw,
} from 'lucide-react';

export function ClientsListPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [industry, setIndustry] = useState('ALL');
  const [country, setCountry] = useState('ALL');
  const [managerId, setManagerId] = useState('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter lists loaded from DB
  const [managers, setManagers] = useState<AuthUser[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Load filter options (managers) and unique values for filters
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const mgrRes = await api.get('/users');
        setManagers((mgrRes.data.data ?? []).filter((u: AuthUser) => u.role !== 'CLIENT'));

        // Load clients without limit to extract unique countries and industries
        const allRes = await api.get('/clients?limit=1000');
        const items = allRes.data.data?.items ?? [];

        const uniqueInd = Array.from(
          new Set(items.map((c: Client) => c.industry).filter(Boolean)),
        ) as string[];
        const uniqueCnt = Array.from(
          new Set(items.map((c: Client) => c.country).filter(Boolean)),
        ) as string[];

        setIndustries(uniqueInd);
        setCountries(uniqueCnt);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    }
    loadFilterOptions();
  }, []);

  // Load clients with pagination and filters
  const loadClients = async () => {
    try {
      const qParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
        ...(search ? { search } : {}),
        ...(status !== 'ALL' ? { status } : {}),
        ...(industry !== 'ALL' ? { industry } : {}),
        ...(country !== 'ALL' ? { country } : {}),
        ...(managerId !== 'ALL' ? { managerId } : {}),
      });

      const response = await api.get(`/clients?${qParams.toString()}`);
      const data = response.data.data;
      setClients(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      notify({
        type: 'error',
        title: 'Error Loading Clients',
        message: errorMessage(err, 'Failed to fetch client list'),
      });
    }
  };

  useEffect(() => {
    loadClients();
  }, [page, status, industry, country, managerId, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadClients();
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
      setSelectedIds(clients.map((c) => c.id));
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

  // Bulk Actions
  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to archive ${selectedIds.length} clients?`)) return;

    try {
      await Promise.all(selectedIds.map((id) => api.post(`/clients/${id}/archive`)));
      notify({
        type: 'success',
        title: 'Bulk Action Successful',
        message: `${selectedIds.length} clients archived successfully`,
      });
      setSelectedIds([]);
      loadClients();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Action Failed',
        message: errorMessage(err, 'Failed to archive clients'),
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedIds.length} clients? This is a soft delete.`,
      )
    )
      return;

    try {
      await Promise.all(selectedIds.map((id) => api.delete(`/clients/${id}`)));
      notify({
        type: 'success',
        title: 'Bulk Action Successful',
        message: `${selectedIds.length} clients deleted successfully`,
      });
      setSelectedIds([]);
      loadClients();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Action Failed',
        message: errorMessage(err, 'Failed to delete clients'),
      });
    }
  };

  // Export CSV
  const exportToCSV = () => {
    const headers = [
      'Company Name',
      'Industry',
      'Email',
      'Phone',
      'Assigned Manager',
      'Status',
      'Created Date',
    ];
    const rows = clients.map((client) => [
      client.companyName,
      client.industry,
      client.email,
      client.phone,
      client.assignedManager
        ? `${client.assignedManager.firstName} ${client.assignedManager.lastName}`
        : 'Unassigned',
      client.status,
      new Date(client.createdAt).toLocaleDateString(),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [
        headers.join(','),
        ...rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'clientflow_clients.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid gap-6">
      {/* Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clients</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Manage your organization's client list, key contacts, and pipeline.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={exportToCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          {user?.role === 'ADMIN' && (
            <Button onClick={() => setShowWizard(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Client
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Actions Header */}
      {selectedIds.length > 0 && user?.role === 'ADMIN' && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <span className="font-semibold">{selectedIds.length} clients selected</span>
          <Button
            variant="ghost"
            onClick={handleBulkArchive}
            className="flex items-center gap-1.5 text-orange-500 hover:bg-orange-500/10 h-8 px-2.5 text-xs"
          >
            <Archive className="h-3.5 w-3.5" /> Archive
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

      {/* Search & Filter Bar */}
      <Card className="flex flex-col gap-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company name, contact, email..."
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

        {/* Expandable Advanced Filters */}
        {showFilters && (
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
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
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-foreground/60">Industry</label>
              <select
                value={industry}
                onChange={(e) => {
                  setIndustry(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              >
                <option value="ALL">All Industries</option>
                {industries.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-foreground/60">Country</label>
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              >
                <option value="ALL">All Countries</option>
                {countries.map((cnt) => (
                  <option key={cnt} value={cnt}>
                    {cnt}
                  </option>
                ))}
              </select>
            </div>
            {user?.role === 'ADMIN' && (
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-foreground/60">Account Manager</label>
                <select
                  value={managerId}
                  onChange={(e) => {
                    setManagerId(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                >
                  <option value="ALL">All Managers</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Clients Table Card */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-foreground">
            <thead>
              <tr className="border-b border-border bg-muted/30 font-semibold text-foreground/80">
                {user?.role === 'ADMIN' && (
                  <th className="px-6 py-4 w-12">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={clients.length > 0 && selectedIds.length === clients.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                )}
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4 cursor-pointer" onClick={() => toggleSort('industry')}>
                  <div className="flex items-center gap-1">
                    Industry {sortBy === 'industry' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4">Account Manager</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 cursor-pointer" onClick={() => toggleSort('createdAt')}>
                  <div className="flex items-center gap-1">
                    Created {sortBy === 'createdAt' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.length === 0 ? (
                <tr>
                  <td
                    colSpan={user?.role === 'ADMIN' ? 7 : 6}
                    className="px-6 py-12 text-center text-foreground/50"
                  >
                    No clients found. Click "Add Client" to register one.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className="cursor-pointer hover:bg-muted/40 transition"
                  >
                    {user?.role === 'ADMIN' && (
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={selectedIds.includes(client.id)}
                          onChange={(e) => handleSelectOne(client.id, e.target.checked)}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {client.companyLogo ? (
                          <img
                            src={client.companyLogo}
                            alt={client.companyName}
                            className="h-8 w-8 rounded-md object-cover border border-border"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                            {client.companyName.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-foreground hover:text-primary transition">
                            {client.companyName}
                          </span>
                          {client.website && (
                            <span className="block text-xs text-foreground/50">
                              {client.website}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{client.industry}</td>
                    <td className="px-6 py-4">
                      <div>{client.email}</div>
                      <div className="text-xs text-foreground/50">{client.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      {client.assignedManager ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {client.assignedManager.firstName.charAt(0)}
                          </div>
                          <span>
                            {client.assignedManager.firstName} {client.assignedManager.lastName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-foreground/45 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          client.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-orange-500/10 text-orange-600'
                        }`}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-foreground/60">
                      {new Date(client.createdAt).toLocaleDateString()}
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
              Showing page {page} of {totalPages} ({total} total clients)
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

      {/* Client Wizard Modal */}
      {showWizard && (
        <ClientWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            loadClients();
            setSelectedIds([]);
          }}
        />
      )}
    </div>
  );
}
