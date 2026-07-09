import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[0.95fr_1.05fr]">
      <section className="hidden border-r border-border bg-card px-12 py-10 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/icon.jpg"
            alt="ClientFlow Logo"
            className="h-8 w-8 rounded-lg shadow-sm border border-border/10"
          />
          <span className="text-xl font-bold text-foreground">ClientFlow</span>
        </div>
        <div className="max-w-md">
          <p className="text-4xl font-semibold leading-tight">
            Agency operations, calmly organized.
          </p>
          <p className="mt-4 text-base leading-7 text-foreground/70">
            Manage clients, projects, teams, invoices, and reporting from one secure workspace.
          </p>
        </div>
        <p className="text-sm text-foreground/60">Built for modern web development agencies.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <Outlet />
      </section>
    </main>
  );
}
