import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  Filter,
  CheckCheck,
  Trash2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  User,
  Handshake,
  Folder,
  Receipt,
  ScrollText,
  CheckSquare,
  Calendar,
  Wrench,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useToastStore } from '../../stores/toast-store';
import { errorMessage } from '../../lib/errors';
import {
  useNotificationStore,
  getNotificationIconDetails,
  getNotificationActionUrl,
  type NotificationRecipientItem,
} from '../../stores/notification-store';

export function NotificationsPage() {
  const navigate = useNavigate();
  const notify = useToastStore((state) => state.notify);
  const { fetchUnreadCount } = useNotificationStore();

  const [items, setItems] = useState<NotificationRecipientItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const isReadParam =
        statusFilter === 'UNREAD' ? 'false' : statusFilter === 'READ' ? 'true' : undefined;

      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', '20');
      if (isReadParam) query.set('isRead', isReadParam);
      if (moduleFilter !== 'ALL') query.set('module', moduleFilter);
      if (typeFilter !== 'ALL') query.set('type', typeFilter);
      if (search.trim()) query.set('search', search.trim());

      const res = await api.get(`/notifications?${query.toString()}`);
      setItems(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
      setTotalPages(res.data.data?.totalPages ?? 1);
      setSelectedIds([]);
      fetchUnreadCount();
    } catch (err) {
      notify({ type: 'error', title: 'Failed to load notifications', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, moduleFilter, typeFilter, search, fetchUnreadCount, notify]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (recipientId: string) => {
    try {
      await api.patch(`/notifications/${recipientId}/read`);
      setItems((prev) =>
        prev.map((i) =>
          i.id === recipientId ? { ...i, isRead: true, readAt: new Date().toISOString() } : i,
        ),
      );
      fetchUnreadCount();
    } catch (err) {
      notify({ type: 'error', title: 'Action failed', message: errorMessage(err) });
    }
  };

  const handleMarkAsUnread = async (recipientId: string) => {
    try {
      await api.patch(`/notifications/${recipientId}/unread`);
      setItems((prev) =>
        prev.map((i) => (i.id === recipientId ? { ...i, isRead: false, readAt: null } : i)),
      );
      fetchUnreadCount();
    } catch (err) {
      notify({ type: 'error', title: 'Action failed', message: errorMessage(err) });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      notify({ type: 'success', title: 'All notifications marked as read' });
      loadNotifications();
    } catch (err) {
      notify({ type: 'error', title: 'Action failed', message: errorMessage(err) });
    }
  };

  const handleDelete = async (recipientId: string) => {
    try {
      await api.delete(`/notifications/${recipientId}`);
      notify({ type: 'success', title: 'Notification deleted' });
      loadNotifications();
    } catch (err) {
      notify({ type: 'error', title: 'Delete failed', message: errorMessage(err) });
    }
  };

  const handleClearRead = async () => {
    if (!window.confirm('Are you sure you want to clear all read notifications?')) return;
    try {
      await api.delete('/notifications/read');
      notify({ type: 'success', title: 'Read notifications cleared' });
      loadNotifications();
    } catch (err) {
      notify({ type: 'error', title: 'Clear failed', message: errorMessage(err) });
    }
  };

  const handleBulkMarkRead = async () => {
    if (selectedIds.length === 0) return;
    try {
      await api.post('/notifications/bulk-read', { ids: selectedIds });
      notify({ type: 'success', title: `${selectedIds.length} notifications marked as read` });
      loadNotifications();
    } catch (err) {
      notify({ type: 'error', title: 'Action failed', message: errorMessage(err) });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected notifications?`)) return;
    try {
      await api.post('/notifications/bulk-delete', { ids: selectedIds });
      notify({ type: 'success', title: `${selectedIds.length} notifications deleted` });
      loadNotifications();
    } catch (err) {
      notify({ type: 'error', title: 'Delete failed', message: errorMessage(err) });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const renderModuleIcon = (type: string, event: string) => {
    const ev = (event || '').toLowerCase();
    const sizeClass = 'h-4 w-4';

    if (ev.startsWith('auth')) return <User className={sizeClass} />;
    if (ev.startsWith('crm')) return <Handshake className={sizeClass} />;
    if (ev.startsWith('project')) return <Folder className={sizeClass} />;
    if (ev.startsWith('invoice')) return <Receipt className={sizeClass} />;
    if (ev.startsWith('quotation')) return <ScrollText className={sizeClass} />;
    if (ev.startsWith('task')) return <CheckSquare className={sizeClass} />;
    if (ev.startsWith('meeting')) return <Calendar className={sizeClass} />;
    if (ev.startsWith('amc')) return <Wrench className={sizeClass} />;

    if (type === 'SUCCESS') return <CheckCircle className={sizeClass} />;
    if (type === 'WARNING') return <AlertTriangle className={sizeClass} />;
    if (type === 'ERROR') return <XCircle className={sizeClass} />;
    return <Info className={sizeClass} />;
  };

  const unreadOnPage = useMemo(() => items.filter((i) => !i.isRead).length, [items]);

  return (
    <div className="grid gap-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-foreground/55">System / Notifications</p>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-foreground">Notification Center</h1>
            {total > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/20">
                {total} Total
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-foreground/55">
            Manage system alerts, business event updates, and module activity logs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={loadNotifications}
            className="border border-border gap-1.5"
            title="Refresh notifications"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleMarkAllRead}
            className="border border-border gap-1.5"
          >
            <CheckCheck className="h-4 w-4" /> Mark All Read
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearRead}
            className="border border-border text-foreground/70 hover:text-foreground gap-1.5"
          >
            <Trash2 className="h-4 w-4" /> Clear Read
          </Button>
        </div>
      </div>

      {/* ── Controls & Filter Bar ── */}
      <Card className="p-4 grid gap-4 border border-border">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px] sm:max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-foreground/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search notifications by title, message or event..."
              className="w-full h-10 rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-foreground/40" />
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
            >
              <option value="ALL">All Types</option>
              <option value="INFO">Info</option>
              <option value="SUCCESS">Success</option>
              <option value="WARNING">Warning</option>
              <option value="ERROR">Error</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
          {/* Read status tabs */}
          <div className="flex flex-wrap gap-1 bg-muted/20 p-1 rounded-xl border border-border">
            {(['ALL', 'UNREAD', 'READ'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === st
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'UNREAD' ? 'Unread' : 'Read'}
              </button>
            ))}
          </div>

          {/* Module pills */}
          <div className="flex flex-wrap gap-1 items-center">
            {[
              { id: 'ALL', label: 'All Modules' },
              { id: 'CRM', label: 'CRM' },
              { id: 'PROJECTS', label: 'Projects' },
              { id: 'FINANCE', label: 'Finance' },
              { id: 'TASKS', label: 'Tasks' },
              { id: 'MEETINGS', label: 'Meetings' },
              { id: 'AMC', label: 'AMC' },
              { id: 'AUTH', label: 'Auth' },
            ].map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => {
                  setModuleFilter(mod.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                  moduleFilter === mod.id
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'border-border text-foreground/60 hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                {mod.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Bulk Actions Toolbar ── */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 animate-in fade-in duration-150">
          <span className="text-xs font-bold text-primary">
            {selectedIds.length} notification{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBulkMarkRead}
              className="h-8 px-3 text-xs font-bold border border-primary/20 gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark Read
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleBulkDelete}
              className="h-8 px-3 text-xs font-bold border border-danger/20 text-danger hover:bg-danger/10 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* ── Notifications List ── */}
      <Card className="p-0 overflow-hidden border border-border">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-foreground/20 mb-3" />
            <h3 className="text-base font-bold text-foreground">No notifications found</h3>
            <p className="text-xs text-foreground/50 mt-1 max-w-sm mx-auto">
              You do not have any notifications matching the selected filters or search query.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* List Header */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/20 text-xs font-bold text-foreground/50 uppercase">
              <input
                type="checkbox"
                checked={selectedIds.length === items.length && items.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
              />
              <span>Select All</span>
              <span className="ml-auto font-normal">
                Page {page} of {totalPages} ({total} Items)
              </span>
            </div>

            {/* List Rows */}
            {items.map((item) => {
              const { moduleLabel, moduleColor } = getNotificationIconDetails(
                item.notification.type,
                item.notification.event,
              );
              const targetUrl = getNotificationActionUrl(
                item.notification.event,
                item.notification.data,
              );
              const isSelected = selectedIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    !item.isRead ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-muted/10'
                  } ${isSelected ? 'bg-primary/10' : ''}`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectItem(item.id)}
                      className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                    />

                    {/* Module Icon */}
                    <div
                      className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center border mt-0.5 ${moduleColor}`}
                    >
                      {renderModuleIcon(item.notification.type, item.notification.event)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${moduleColor}`}
                        >
                          {moduleLabel}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase ${
                            item.notification.type === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : item.notification.type === 'WARNING'
                                ? 'bg-amber-500/10 text-amber-600'
                                : item.notification.type === 'ERROR'
                                  ? 'bg-rose-500/10 text-rose-600'
                                  : 'bg-blue-500/10 text-blue-600'
                          }`}
                        >
                          {item.notification.type}
                        </span>
                        {!item.isRead && (
                          <span className="px-2 py-0.5 rounded-full bg-primary text-[9px] font-bold text-white">
                            NEW
                          </span>
                        )}
                        <span className="text-[10px] text-foreground/45 font-medium ml-auto sm:ml-0">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-foreground leading-snug">
                        {item.notification.title}
                      </h4>
                      <p className="text-xs text-foreground/70 mt-1 leading-relaxed">
                        {item.notification.message}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (!item.isRead) handleMarkAsRead(item.id);
                        navigate(targetUrl);
                      }}
                      className="h-8 px-2.5 text-xs font-bold gap-1 border border-border hover:border-primary/50"
                      title="Open linked module"
                    >
                      View Entity <ExternalLink className="h-3 w-3 text-primary" />
                    </Button>

                    {item.isRead ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleMarkAsUnread(item.id)}
                        className="h-8 w-8 p-0"
                        title="Mark as unread"
                      >
                        <EyeOff className="h-3.5 w-3.5 text-foreground/50" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleMarkAsRead(item.id)}
                        className="h-8 w-8 p-0"
                        title="Mark as read"
                      >
                        <Eye className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      className="h-8 w-8 p-0 text-foreground/40 hover:text-danger hover:bg-danger/10"
                      title="Delete notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Pagination Controls ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 p-2">
          <p className="text-xs font-medium text-foreground/55">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-3 text-xs font-bold border border-border gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-3 text-xs font-bold border border-border gap-1"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
