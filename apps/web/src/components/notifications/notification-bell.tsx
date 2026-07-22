import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
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
  ChevronRight,
} from 'lucide-react';
import {
  useNotificationStore,
  formatRelativeTime,
  getNotificationIconDetails,
  getNotificationActionUrl,
  type NotificationRecipientItem,
} from '../../stores/notification-store';

export function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    unreadCount,
    unreadItems,
    fetchUnreadCount,
    fetchUnreadItems,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // refresh count every 30s
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleToggle = () => {
    if (!isOpen) {
      fetchUnreadItems();
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = async (item: NotificationRecipientItem) => {
    if (!item.isRead) {
      await markAsRead(item.id);
    }
    setIsOpen(false);
    const targetUrl = getNotificationActionUrl(item.notification.event, item.notification.data);
    navigate(targetUrl);
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        aria-label="Notifications"
        onClick={handleToggle}
        className="relative rounded-xl p-2.5 text-foreground hover:bg-muted transition-colors border border-border flex items-center justify-center"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white shadow-sm animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-card p-0 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline transition"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
            {unreadItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-foreground/50">
                <Bell className="h-8 w-8 mx-auto mb-2 text-foreground/20" />
                <p className="font-semibold">No unread notifications</p>
                <p className="text-[11px] text-foreground/40 mt-1">You are all caught up!</p>
              </div>
            ) : (
              unreadItems.map((item) => {
                const { moduleLabel, moduleColor } = getNotificationIconDetails(
                  item.notification.type,
                  item.notification.event,
                );

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className="w-full p-3 text-left hover:bg-muted/40 transition flex items-start gap-3 group relative"
                  >
                    <div
                      className={`h-8 w-8 shrink-0 rounded-xl flex items-center justify-center border ${moduleColor}`}
                    >
                      {renderModuleIcon(item.notification.type, item.notification.event)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                          {moduleLabel}
                        </span>
                        <span className="text-[10px] font-medium text-foreground/45">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-primary transition">
                        {item.notification.title}
                      </p>
                      <p className="text-xs text-foreground/60 line-clamp-2 mt-0.5 leading-relaxed">
                        {item.notification.message}
                      </p>
                    </div>
                    {!item.isRead && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-2 bg-muted/10 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 transition flex items-center justify-center gap-1"
            >
              View All Notifications <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
