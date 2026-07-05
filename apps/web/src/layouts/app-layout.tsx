import { Bell, Menu, Moon, Search, Sun, UserCircle } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';
import { Button } from '../components/ui/button';
import { navItems } from '../nav';

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const crumbs = location.pathname.split('/').filter(Boolean);

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center px-5 text-lg font-bold text-primary">ClientFlow</div>
      <nav className="grid gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-foreground/75 hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-border p-4 text-xs text-foreground/60">
        Role: <span className="font-semibold text-foreground">{user?.role}</span>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[288px_1fr]">
      <div className="hidden lg:block">{sidebar}</div>
      {open ? (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full" onClick={(event) => event.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <button
            aria-label="Open navigation"
            className="rounded-md p-2 hover:bg-muted lg:hidden"
            type="button"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-card px-3 md:flex">
            <Search className="h-4 w-4 text-foreground/50" />
            <span className="text-sm text-foreground/50">Search workspace</span>
          </div>
          <button
            aria-label="Toggle theme"
            className="rounded-md p-2 hover:bg-muted"
            type="button"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            aria-label="Notifications"
            className="rounded-md p-2 hover:bg-muted"
            type="button"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            aria-label="Profile"
            className="flex items-center gap-2 rounded-md p-2 hover:bg-muted"
            type="button"
            onClick={() => navigate('/profile')}
          >
            <UserCircle className="h-5 w-5" />
            <span className="hidden text-sm font-medium sm:inline">{user?.firstName}</span>
          </button>
          <Button
            variant="ghost"
            onClick={() => {
              void logout().then(() => navigate('/login'));
            }}
          >
            Logout
          </Button>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-foreground/60">
            <span>Workspace</span>
            {crumbs.map((crumb) => (
              <span key={crumb} className="capitalize">
                / {crumb.replace('-', ' ')}
              </span>
            ))}
          </div>
          <Outlet />
        </main>

        <footer className="border-t border-border px-6 py-5 text-sm text-foreground/60">
          ClientFlow Phase 1 foundation
        </footer>
      </div>
    </div>
  );
}
