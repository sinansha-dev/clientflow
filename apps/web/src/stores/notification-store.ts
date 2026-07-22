import { create } from 'zustand';
import { api } from '../lib/api';

export interface NotificationItem {
  id: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  event: string;
  title: string;
  message: string;
  data?: any;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  createdAt: string;
}

export interface NotificationRecipientItem {
  id: string;
  notificationId: string;
  userId: string;
  isRead: boolean;
  readAt: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  notification: NotificationItem;
}

interface NotificationState {
  unreadCount: number;
  unreadItems: NotificationRecipientItem[];
  loading: boolean;
  fetchUnreadCount: () => Promise<number>;
  fetchUnreadItems: () => Promise<void>;
  markAsRead: (recipientId: string) => Promise<void>;
  markAsUnread: (recipientId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (recipientId: string) => Promise<void>;
  clearReadNotifications: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  unreadItems: [],
  loading: false,

  fetchUnreadCount: async () => {
    try {
      const res = await api.get('/notifications/count');
      const count = res.data.data?.count ?? 0;
      set({ unreadCount: count });
      return count;
    } catch {
      return get().unreadCount;
    }
  },

  fetchUnreadItems: async () => {
    try {
      set({ loading: true });
      const res = await api.get('/notifications/unread?limit=10');
      const items: NotificationRecipientItem[] = res.data.data?.items ?? [];
      const total = res.data.data?.total ?? items.length;
      set({ unreadItems: items, unreadCount: total, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  markAsRead: async (recipientId: string) => {
    try {
      await api.patch(`/notifications/${recipientId}/read`);
      set((state) => {
        const updatedItems = state.unreadItems.filter((i) => i.id !== recipientId);
        const newCount = Math.max(0, state.unreadCount - 1);
        return { unreadItems: updatedItems, unreadCount: newCount };
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  },

  markAsUnread: async (recipientId: string) => {
    try {
      await api.patch(`/notifications/${recipientId}/unread`);
      set((state) => ({ unreadCount: state.unreadCount + 1 }));
      get().fetchUnreadItems();
    } catch (err) {
      console.error('Failed to mark notification as unread:', err);
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch('/notifications/read-all');
      set({ unreadItems: [], unreadCount: 0 });
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  },

  deleteNotification: async (recipientId: string) => {
    try {
      await api.delete(`/notifications/${recipientId}`);
      set((state) => {
        const isUnread = state.unreadItems.some((i) => i.id === recipientId);
        const updatedItems = state.unreadItems.filter((i) => i.id !== recipientId);
        const newCount = isUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount;
        return { unreadItems: updatedItems, unreadCount: newCount };
      });
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  },

  clearReadNotifications: async () => {
    try {
      await api.delete('/notifications/read');
    } catch (err) {
      console.error('Failed to clear read notifications:', err);
    }
  },
}));

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function getNotificationIconDetails(type: string, event: string) {
  const ev = (event || '').toLowerCase();

  let moduleLabel = 'System';
  let moduleColor = 'bg-blue-500/10 text-blue-600 border-blue-500/20';

  if (ev.startsWith('auth')) {
    moduleLabel = 'Auth';
    moduleColor = 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
  } else if (ev.startsWith('crm')) {
    moduleLabel = 'CRM';
    moduleColor = 'bg-purple-500/10 text-purple-600 border-purple-500/20';
  } else if (ev.startsWith('project')) {
    moduleLabel = 'Projects';
    moduleColor = 'bg-sky-500/10 text-sky-600 border-sky-500/20';
  } else if (ev.startsWith('invoice')) {
    moduleLabel = 'Invoice';
    moduleColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  } else if (ev.startsWith('quotation')) {
    moduleLabel = 'Quotation';
    moduleColor = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  } else if (ev.startsWith('task')) {
    moduleLabel = 'Tasks';
    moduleColor = 'bg-teal-500/10 text-teal-600 border-teal-500/20';
  } else if (ev.startsWith('meeting')) {
    moduleLabel = 'Meetings';
    moduleColor = 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
  } else if (ev.startsWith('amc')) {
    moduleLabel = 'AMC';
    moduleColor = 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  }

  let typeColor = 'text-blue-500 bg-blue-500/10';
  if (type === 'SUCCESS') typeColor = 'text-emerald-500 bg-emerald-500/10';
  if (type === 'WARNING') typeColor = 'text-amber-500 bg-amber-500/10';
  if (type === 'ERROR') typeColor = 'text-rose-500 bg-rose-500/10';

  return { moduleLabel, moduleColor, typeColor };
}

export function getNotificationActionUrl(event: string, data?: any): string {
  if (data?.actionUrl && typeof data.actionUrl === 'string' && data.actionUrl.startsWith('/')) {
    return data.actionUrl;
  }

  const ev = (event || '').toLowerCase();

  if (ev.startsWith('invoice')) {
    return '/invoices?tab=invoices';
  }
  if (ev.startsWith('quotation')) {
    return '/invoices?tab=quotes';
  }
  if (ev.startsWith('project')) {
    return '/projects';
  }
  if (ev.startsWith('task')) {
    return '/tasks';
  }
  if (ev.startsWith('meeting')) {
    return '/calendar';
  }
  if (ev.startsWith('amc')) {
    return '/projects';
  }
  if (ev.startsWith('crm')) {
    return '/clients';
  }
  if (ev.startsWith('auth')) {
    return '/profile';
  }
  return '/notifications';
}
