import type { AuthUser } from '@clientflow/types';
import { create } from 'zustand';
import { api, setAccessToken } from '../lib/api';

interface AuthState {
  user: AuthUser | null;
  isBootstrapped: boolean;
  setSession: (user: AuthUser | null, token?: string | null) => void;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isBootstrapped: false,

  setSession: (user, token = null) => {
    setAccessToken(token);
    set({ user });
  },

  bootstrap: async () => {
    try {
      const response = await api.get('/auth/me');
      set({ user: response.data.data.user, isBootstrapped: true });
    } catch {
      try {
        const refresh = await api.post('/auth/refresh');
        setAccessToken(refresh.data.data.accessToken);
        set({ user: refresh.data.data.user, isBootstrapped: true });
      } catch {
        setAccessToken(null);
        set({ user: null, isBootstrapped: true });
      }
    }
  },

  logout: async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    set({ user: null });
  },
}));
