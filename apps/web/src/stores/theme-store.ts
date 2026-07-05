import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const storedTheme = (localStorage.getItem('clientflow-theme') as Theme | null) ?? 'light';
document.documentElement.classList.toggle('dark', storedTheme === 'dark');

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: storedTheme,
  setTheme: (theme) => {
    localStorage.setItem('clientflow-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },
  toggleTheme: () => {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
  },
}));
