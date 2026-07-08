import { Bell, Menu, Moon, Search, Sun, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';
import { Button } from '../components/ui/button';
import { navItems } from '../nav';
import { api } from '../lib/api';

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const crumbs = location.pathname.split('/').filter(Boolean);
  const visibleNavItems = navItems.filter((item) => user && item.roles.includes(user.role));

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    projects: any[];
    tasks: any[];
    clients: any[];
    team: any[];
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data.data);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (user?.role === 'CLIENT' && !['/portal', '/profile'].includes(location.pathname)) {
      navigate('/portal', { replace: true });
    }
  }, [location.pathname, navigate, user]);

  const sidebar = (
    <aside
      className={`flex h-full flex-col border-r border-border bg-card transition-all duration-300 ${
        isCollapsed ? 'lg:w-[72px] w-72' : 'w-72'
      }`}
    >
      <div className="flex h-16 items-center px-5 text-primary">
        <span
          className={`text-lg font-bold transition-all duration-200 ${isCollapsed ? 'lg:hidden' : ''}`}
        >
          ClientFlow
        </span>
        <span
          className={`text-xl font-black transition-all duration-200 mx-auto ${isCollapsed ? 'hidden lg:block' : 'hidden'}`}
        >
          CF
        </span>
      </div>

      <nav
        className={`grid gap-1 px-3 transition-all duration-300 ${isCollapsed ? 'lg:justify-items-center' : ''}`}
      >
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex h-10 items-center rounded-md px-3 text-sm font-medium transition-all duration-200 ${
                isCollapsed ? 'lg:justify-center lg:w-10 lg:p-0 w-full gap-3' : 'gap-3 w-full'
              } ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-foreground/75 hover:bg-muted hover:text-foreground'
              }`
            }
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span
              className={`truncate transition-all duration-200 ${isCollapsed ? 'lg:hidden' : ''}`}
            >
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        {/* Toggle Button - desktop only */}
        <button
          onClick={handleToggleSidebar}
          className={`mx-3 hidden lg:flex h-9 items-center justify-center rounded-md border border-border bg-card/50 text-foreground/60 hover:bg-muted hover:text-foreground transition-all duration-200 ${
            isCollapsed ? 'w-10 p-0' : 'px-3 gap-2 text-xs font-semibold'
          }`}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">Collapse Sidebar</span>
            </>
          )}
        </button>

        <div
          className={`border-t border-border p-4 text-xs text-foreground/60 transition-all duration-300 ${
            isCollapsed ? 'lg:text-center lg:px-1' : ''
          }`}
        >
          {isCollapsed ? (
            <span
              className="hidden lg:inline font-bold text-foreground capitalize"
              title={`Role: ${user?.role}`}
            >
              {user?.role?.charAt(0)}
            </span>
          ) : null}
          <span className={isCollapsed ? 'lg:hidden' : ''}>
            Role: <span className="font-semibold text-foreground">{user?.role}</span>
          </span>
        </div>
      </div>
    </aside>
  );

  return (
    <div
      className={`min-h-screen bg-background lg:grid transition-all duration-300 ${
        isCollapsed ? 'lg:grid-cols-[72px_1fr]' : 'lg:grid-cols-[288px_1fr]'
      }`}
    >
      <div className="hidden lg:block sticky top-0 h-screen z-40">{sidebar}</div>
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
          <div
            className="relative hidden min-w-0 flex-1 items-center md:block max-w-md"
            ref={dropdownRef}
          >
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 h-10 w-full">
              <Search className="h-4 w-4 text-foreground/50 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search workspace..."
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/45"
              />
              {isSearching && (
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              )}
            </div>

            {showDropdown && searchResults && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-96 overflow-y-auto z-50 p-2">
                {/* Projects */}
                {searchResults.projects.length > 0 && (
                  <div className="mb-3">
                    <h3 className="px-2 py-1 text-[10px] font-bold text-foreground/45 uppercase tracking-wider">
                      Projects
                    </h3>
                    <div className="grid gap-0.5 mt-1">
                      {searchResults.projects.map((p: any) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (user?.role === 'CLIENT') {
                              localStorage.setItem('client-portal-project-id', p.id);
                              navigate('/portal');
                            } else {
                              navigate(`/projects/${p.id}`);
                            }
                            setShowDropdown(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted text-xs transition-colors flex justify-between items-center"
                        >
                          <span className="font-semibold text-foreground">{p.projectName}</span>
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                            {p.projectCode}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tasks */}
                {searchResults.tasks.length > 0 && (
                  <div className="mb-3">
                    <h3 className="px-2 py-1 text-[10px] font-bold text-foreground/45 uppercase tracking-wider">
                      Tasks
                    </h3>
                    <div className="grid gap-0.5 mt-1">
                      {searchResults.tasks.map((t: any) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            if (user?.role === 'CLIENT') {
                              localStorage.setItem('client-portal-project-id', t.projectId);
                              navigate('/portal');
                            } else {
                              navigate('/tasks');
                            }
                            setShowDropdown(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted text-xs transition-colors flex flex-col gap-0.5"
                        >
                          <span className="font-medium text-foreground">{t.title}</span>
                          <span className="text-[10px] text-foreground/45">
                            Project: {t.project.projectName} &bull; Status: {t.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clients */}
                {searchResults.clients.length > 0 && (
                  <div className="mb-3">
                    <h3 className="px-2 py-1 text-[10px] font-bold text-foreground/45 uppercase tracking-wider">
                      Clients (CRM)
                    </h3>
                    <div className="grid gap-0.5 mt-1">
                      {searchResults.clients.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            navigate(`/clients/${c.id}`);
                            setShowDropdown(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted text-xs transition-colors flex justify-between items-center"
                        >
                          <span className="font-semibold text-foreground">{c.companyName}</span>
                          <span className="text-[10px] text-foreground/45">{c.email}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Team */}
                {searchResults.team.length > 0 && (
                  <div className="mb-3">
                    <h3 className="px-2 py-1 text-[10px] font-bold text-foreground/45 uppercase tracking-wider">
                      Team
                    </h3>
                    <div className="grid gap-0.5 mt-1">
                      {searchResults.team.map((m: any) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            navigate('/team');
                            setShowDropdown(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted text-xs transition-colors flex justify-between items-center"
                        >
                          <span className="font-semibold text-foreground">
                            {m.firstName} {m.lastName}
                          </span>
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded capitalize">
                            {m.role.toLowerCase()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchResults.projects.length === 0 &&
                  searchResults.tasks.length === 0 &&
                  searchResults.clients.length === 0 &&
                  searchResults.team.length === 0 && (
                    <div className="p-4 text-center text-xs text-foreground/45">
                      No results found
                    </div>
                  )}
              </div>
            )}
          </div>
          <button
            aria-label="Toggle theme"
            className="ml-auto rounded-md p-2 hover:bg-muted"
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

        <main className="w-full px-4 py-6 md:px-8">
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
