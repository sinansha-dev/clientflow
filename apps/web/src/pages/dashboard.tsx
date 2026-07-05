import { Card } from '../components/ui/card';
import { useAuthStore } from '../stores/auth-store';

const metrics = [
  { label: 'Active projects', value: '12', tone: 'text-primary' },
  { label: 'Open tasks', value: '48', tone: 'text-secondary' },
  { label: 'Pending invoices', value: '7', tone: 'text-warning' },
  { label: 'At risk', value: '2', tone: 'text-danger' },
];

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-foreground/65">
          Welcome back, {user?.firstName}. Your workspace foundation is ready.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <p className="text-sm text-foreground/60">{metric.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${metric.tone}`}>{metric.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <div className="mt-5 grid gap-4">
            {[
              'Client portal foundation created',
              'Authentication routes secured',
              'Dashboard shell prepared',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <span className="text-sm font-medium">{item}</span>
                <span className="text-xs text-foreground/55">Today</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Empty state</h2>
          <div className="mt-5 rounded-md border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium">No upcoming deadlines</p>
            <p className="mt-2 text-sm text-foreground/60">
              Project data will appear here in later phases.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
