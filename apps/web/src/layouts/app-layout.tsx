import {
  Bell,
  Menu,
  Moon,
  Search,
  Sun,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Palette,
  Plus,
  Command,
  X,
  Layers,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';
import { Button } from '../components/ui/button';
import { navItems } from '../nav';
import { api } from '../lib/api';
import { NotificationBell } from '../components/notifications/notification-bell';

type WorkspaceAccent = 'emerald' | 'blue' | 'rose' | 'amber';
type WorkspaceDensity = 'comfortable' | 'compact';

const workspaceAccents: Record<
  WorkspaceAccent,
  {
    label: string;
    swatch: string;
    primary: string;
    text: string;
    bg: string;
    border: string;
  }
> = {
  emerald: {
    label: 'Emerald',
    swatch: 'bg-emerald-400',
    primary: '152 69% 45%',
    text: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/25',
  },
  blue: {
    label: 'Blue',
    swatch: 'bg-blue-500',
    primary: '217 91% 56%',
    text: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
  },
  rose: {
    label: 'Rose',
    swatch: 'bg-rose-400',
    primary: '346 72% 74%',
    text: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/25',
  },
  amber: {
    label: 'Amber',
    swatch: 'bg-amber-500',
    primary: '38 92% 50%',
    text: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
  },
};

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [workspaceAccent, setWorkspaceAccent] = useState<WorkspaceAccent>(() => {
    const stored = localStorage.getItem('workspace-accent') as WorkspaceAccent | null;
    return stored && stored in workspaceAccents ? stored : 'blue';
  });
  const [workspaceDensity, setWorkspaceDensity] = useState<WorkspaceDensity>(() => {
    const stored = localStorage.getItem('workspace-density') as WorkspaceDensity | null;
    return stored === 'compact' ? stored : 'comfortable';
  });

  const customizeRef = useRef<HTMLDivElement>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search API fetch
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
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Click outside customize and quick-create
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (customizeRef.current && !customizeRef.current.contains(target)) {
        setIsCustomizeOpen(false);
      }
      if (quickCreateRef.current && !quickCreateRef.current.contains(target)) {
        setIsQuickCreateOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-focus search input when search modal opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const accent = workspaceAccents[workspaceAccent];
    localStorage.setItem('workspace-accent', workspaceAccent);
    document.documentElement.style.setProperty('--primary', accent.primary);
    window.dispatchEvent(new CustomEvent('workspace-preferences-changed'));
  }, [workspaceAccent]);

  useEffect(() => {
    localStorage.setItem('workspace-density', workspaceDensity);
    document.documentElement.dataset.density = workspaceDensity;
    window.dispatchEvent(new CustomEvent('workspace-preferences-changed'));
  }, [workspaceDensity]);

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
      className={`flex h-full flex-col bg-[#0b0f19] text-slate-300 transition-all duration-300 overflow-x-hidden ${
        isCollapsed ? 'lg:w-[76px] w-72' : 'w-[260px]'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center px-5 shrink-0 justify-between">
        {isCollapsed ? (
          <img
            src="/icon.jpg"
            alt="ClientFlow Logo"
            className="mx-auto h-8 w-8 rounded-xl shadow-md border border-white/10"
          />
        ) : (
          <div className="flex items-center gap-3">
            <img
              src="/icon.jpg"
              alt="ClientFlow Logo"
              className="h-8 w-8 rounded-xl shadow-md border border-white/10"
            />
            <span className="text-md font-bold text-white tracking-wide">ClientFlow</span>
          </div>
        )}
      </div>

      {/* Navigation menu */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 space-y-1 no-scrollbar">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex h-10 items-center rounded-xl px-3 text-xs font-medium transition-all duration-150 ${
                isCollapsed ? 'lg:justify-center lg:w-10 lg:p-0 w-full gap-3' : 'gap-3 w-full'
              } ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold shadow-sm border border-primary/20'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
              }`
            }
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-3 space-y-2 shrink-0">
        {/* Toggle Collapse - Desktop only */}
        <button
          onClick={handleToggleSidebar}
          className={`hidden lg:flex w-full h-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white/[0.04] hover:text-white transition-colors duration-150 ${
            isCollapsed ? 'p-0' : 'px-3 gap-2 text-xs font-semibold'
          }`}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">Collapse Sidebar</span>
            </>
          )}
        </button>

        {/* Current User Card */}
        <div
          className={`flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/5 transition-all duration-300 ${
            isCollapsed ? 'lg:justify-center lg:p-1.5' : ''
          }`}
        >
          <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/25">
            {user?.firstName.charAt(0)}
            {user?.lastName.charAt(0)}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-slate-500 truncate capitalize mt-0.5 leading-none">
                {user?.role.toLowerCase()}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div
      className={`min-h-screen bg-background lg:grid transition-all duration-300 ${
        isCollapsed ? 'lg:grid-cols-[76px_1fr]' : 'lg:grid-cols-[260px_1fr]'
      }`}
    >
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block sticky top-0 h-screen z-40 shrink-0">{sidebar}</div>

      {/* Sidebar - Mobile Drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full" onClick={(event) => event.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="min-w-0 flex flex-col min-h-screen">
        {/* Top Header Navigation */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md md:px-6 shrink-0 shadow-sm shadow-foreground/5 justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Mobile Hamburger menu */}
            <button
              aria-label="Open navigation"
              className="rounded-xl p-2.5 hover:bg-muted text-foreground lg:hidden transition-colors border border-border"
              type="button"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Premium Command Search trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2.5 rounded-xl border border-border hover:border-foreground/20 bg-background/50 hover:bg-background/80 px-3.5 h-10 w-full max-w-sm text-foreground/50 transition duration-150 text-left outline-none cursor-pointer"
            >
              <Search className="h-4 w-4 text-foreground/45 shrink-0" />
              <span className="text-xs flex-1">Search workspace...</span>
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-foreground/50">
                <span className="text-[10px]">Ctrl</span>K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Create Dropdown */}
            <div className="relative" ref={quickCreateRef}>
              <button
                onClick={() => setIsQuickCreateOpen(!isQuickCreateOpen)}
                className="flex items-center justify-center h-10 w-10 sm:h-10 sm:px-4 gap-2 rounded-xl bg-primary text-white hover:bg-primary/95 text-xs font-bold shadow-md shadow-primary/10 transition-colors"
                title="Quick Create"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </button>
              {isQuickCreateOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-2xl text-xs font-semibold text-foreground">
                  <button
                    onClick={() => {
                      navigate('/tasks');
                      setIsQuickCreateOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    New Task
                  </button>
                  <button
                    onClick={() => {
                      navigate('/projects');
                      setIsQuickCreateOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    New Project
                  </button>
                  <button
                    onClick={() => {
                      navigate('/clients');
                      setIsQuickCreateOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    Add Client
                  </button>
                  <button
                    onClick={() => {
                      navigate('/invoices');
                      setIsQuickCreateOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors border-t border-border mt-1"
                  >
                    Create Invoice
                  </button>
                </div>
              )}
            </div>

            {/* Notifications Trigger */}
            <NotificationBell />

            {/* Theme Toggle */}
            <button
              aria-label="Toggle theme"
              className="rounded-xl p-2.5 text-foreground hover:bg-muted transition-colors border border-border"
              type="button"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Workspace Customizer */}
            <div className="relative" ref={customizeRef}>
              <button
                aria-label="Customize workspace"
                className="flex items-center justify-center h-10 w-10 rounded-xl text-foreground hover:bg-muted transition-colors border border-border"
                type="button"
                onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
              >
                <Palette className="h-4 w-4" />
              </button>
              {isCustomizeOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card p-4 text-left shadow-2xl">
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                      Accent color
                    </p>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {(Object.keys(workspaceAccents) as WorkspaceAccent[]).map((key) => {
                        const item = workspaceAccents[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setWorkspaceAccent(key)}
                            className={`flex h-10 items-center justify-center rounded-lg border transition ${
                              workspaceAccent === key
                                ? 'border-primary bg-primary/10'
                                : 'border-border bg-background/50 hover:bg-muted'
                            }`}
                            title={item.label}
                          >
                            <span className={`h-4 w-4 rounded-full ${item.swatch}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                      Density
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(['comfortable', 'compact'] as WorkspaceDensity[]).map((density) => {
                        const active = workspaceDensity === density;
                        const accent = workspaceAccents[workspaceAccent];
                        return (
                          <button
                            key={density}
                            type="button"
                            onClick={() => setWorkspaceDensity(density)}
                            className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition ${
                              active
                                ? `${accent.bg} ${accent.border} ${accent.text}`
                                : 'border-border bg-background/50 text-foreground/60 hover:bg-muted'
                            }`}
                          >
                            {density}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Logout button */}
            <Button
              variant="ghost"
              className="h-10 px-3 rounded-xl border border-border text-xs font-bold"
              onClick={() => {
                void logout().then(() => navigate('/login'));
              }}
            >
              Logout
            </Button>
          </div>
        </header>

        {/* Global Search Overlay (Command Palette) */}
        {isSearchOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
            }}
          >
            <div
              className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[70vh] scale-100 transition-all duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Bar header */}
              <div className="flex h-14 items-center gap-3 border-b border-border px-4">
                <Search className="h-5 w-5 text-foreground/50 shrink-0" />
                <input
                  type="text"
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to search clients, projects, tasks, or team members..."
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/40"
                />
                {isSearching && (
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                )}
                <button
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="rounded-lg p-1.5 hover:bg-muted text-foreground/50 transition-colors border border-border"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search Results listing */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[50vh] scrollbar-thin">
                {!searchQuery.trim() ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-foreground/45">
                    <Command className="h-10 w-10 mb-3 text-foreground/30 animate-pulse" />
                    <p className="text-xs font-bold">Search Command Palette</p>
                    <p className="text-[10px] mt-1 text-foreground/40">
                      Type query to search clients, projects, or tasks
                    </p>
                  </div>
                ) : searchResults ? (
                  <>
                    {/* Projects */}
                    {searchResults.projects.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 px-2 mb-1">
                          Projects
                        </h4>
                        <div className="grid gap-1">
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
                                setIsSearchOpen(false);
                                setSearchQuery('');
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-muted text-xs transition-colors flex justify-between items-center border border-transparent hover:border-border"
                            >
                              <span className="font-bold text-foreground">{p.projectName}</span>
                              <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono border border-primary/20">
                                {p.projectCode}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tasks */}
                    {searchResults.tasks.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 px-2 mb-1">
                          Tasks
                        </h4>
                        <div className="grid gap-1">
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
                                setIsSearchOpen(false);
                                setSearchQuery('');
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-muted text-xs transition-colors flex flex-col gap-1 border border-transparent hover:border-border"
                            >
                              <span className="font-bold text-foreground">{t.title}</span>
                              <span className="text-[9px] text-foreground/50 leading-none">
                                Project: {t.project.projectName} &bull; Status: {t.status}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clients */}
                    {searchResults.clients.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 px-2 mb-1">
                          Clients (CRM)
                        </h4>
                        <div className="grid gap-1">
                          {searchResults.clients.map((c: any) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                navigate(`/clients/${c.id}`);
                                setIsSearchOpen(false);
                                setSearchQuery('');
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-muted text-xs transition-colors flex justify-between items-center border border-transparent hover:border-border"
                            >
                              <span className="font-bold text-foreground">{c.companyName}</span>
                              <span className="text-[10px] text-foreground/50">{c.email}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team */}
                    {searchResults.team.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 px-2 mb-1">
                          Team
                        </h4>
                        <div className="grid gap-1">
                          {searchResults.team.map((m: any) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                navigate('/team');
                                setIsSearchOpen(false);
                                setSearchQuery('');
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-muted text-xs transition-colors flex justify-between items-center border border-transparent hover:border-border"
                            >
                              <span className="font-bold text-foreground text-sm">
                                {m.firstName} {m.lastName}
                              </span>
                              <span className="text-[9px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full capitalize">
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
                        <div className="py-12 text-center text-xs text-foreground/45 italic">
                          No results match "{searchQuery}"
                        </div>
                      )}
                  </>
                ) : (
                  <div className="py-12 text-center text-xs text-foreground/45 animate-pulse">
                    Searching workspace database...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main responsive content container */}
        <main className="w-full flex-1 max-w-[1600px] mx-auto px-4 py-6 md:px-8">
          <div className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-foreground/50 font-bold">
            <span className="hover:text-foreground cursor-pointer transition-colors">
              Workspace
            </span>
            {crumbs.map((crumb) => (
              <span key={crumb} className="capitalize flex items-center gap-1.5 select-none">
                <span>/</span>
                <span className="text-foreground/75">{crumb.replace('-', ' ')}</span>
              </span>
            ))}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
