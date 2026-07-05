import { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { useAuthStore } from '../stores/auth-store';
import { api } from '../lib/api';
import type { Client, Project } from '@clientflow/types';
import {
  Building2,
  UsersRound,
  Archive,
  CalendarRange,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarDays,
  Activity,
} from 'lucide-react';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [hoursToday, setHoursToday] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardStats() {
      try {
        const [cliRes, prjRes] = await Promise.all([
          api.get('/clients?limit=1000'),
          api.get('/projects?limit=1000'),
        ]);
        setClients(cliRes.data.data?.items ?? []);
        setProjects(prjRes.data.data?.items ?? []);

        if (user && user.role !== 'CLIENT') {
          try {
            const [teamRes, meetRes, logRes] = await Promise.all([
              api.get('/team?limit=1000'),
              api.get('/meetings'),
              api.get('/timelogs'),
            ]);
            setTeamMembers(teamRes.data.data?.items ?? []);
            setMeetings(meetRes.data.data ?? []);

            const todayStr = new Date().toISOString().split('T')[0];
            const logsToday = (logRes.data.data ?? []).filter((l: any) => {
              return new Date(l.startTime).toISOString().split('T')[0] === todayStr;
            });
            const loggedToday = logsToday.reduce((acc: number, l: any) => acc + l.duration, 0);
            setHoursToday(Math.round(loggedToday * 10) / 10);
          } catch (e) {
            console.error('Failed to load dashboard workforce stats:', e);
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard CRM and project stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardStats();
  }, [user]);

  // CRM Calculations
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.status === 'ACTIVE').length;

  // Projects Calculations
  const totalProjects = projects.length;
  const activeProjects = projects.filter(
    (p) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED',
  ).length;
  const completedProjects = projects.filter((p) => p.status === 'COMPLETED').length;

  // Computed Health stats
  const delayedProjects = projects.filter((p) => p.healthStatus === 'DELAYED').length;

  // Projects near deadline (less than 7 days left)
  const now = new Date();
  const nearDeadlineProjects = projects.filter((p) => {
    if (p.status === 'COMPLETED' || p.status === 'CANCELLED') return false;
    const deadline = new Date(p.deadline);
    const diff = deadline.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 7;
  }).length;

  // Upcoming Milestones from all active projects
  const upcomingMilestones: Array<{
    prjName: string;
    title: string;
    dueDate: string;
    status: string;
  }> = [];
  projects.forEach((p) => {
    if (p.status !== 'COMPLETED' && p.milestones) {
      p.milestones.forEach((m) => {
        if (m.status !== 'COMPLETED') {
          upcomingMilestones.push({
            prjName: p.projectName,
            title: m.title,
            dueDate: m.dueDate.toString(),
            status: m.status,
          });
        }
      });
    }
  });

  // Sort upcoming milestones by due date and take top 5
  const sortedMilestones = upcomingMilestones
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  // Recent Activities
  const recentActivities: Array<{ prjName: string; desc: string; time: string }> = [];
  projects.forEach((p) => {
    if (p.activities) {
      p.activities.forEach((act) => {
        recentActivities.push({
          prjName: p.projectName,
          desc: act.description,
          time: act.createdAt.toString(),
        });
      });
    }
  });

  // Sort recent activities by time (newest first) and take top 5
  const sortedActivities = recentActivities
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  const metrics = [
    { label: 'Active Projects', value: activeProjects, icon: FolderKanban, tone: 'text-primary' },
    {
      label: 'Near Deadline',
      value: nearDeadlineProjects,
      icon: CalendarDays,
      tone: 'text-orange-500',
    },
    { label: 'Delayed Projects', value: delayedProjects, icon: AlertTriangle, tone: 'text-danger' },
    {
      label: 'Completed Projects',
      value: completedProjects,
      icon: CheckCircle2,
      tone: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid gap-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-2 text-sm text-foreground/65">
          Welcome back, {user?.firstName}. Here is a summary of your workspace activities and client
          pipeline.
        </p>
      </div>

      {/* Projects Dashboard Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                {metric.label}
              </p>
              <p className={`mt-2 text-3xl font-bold ${metric.tone}`}>
                {loading ? '...' : metric.value}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/40 text-foreground/60">
              <metric.icon className="h-6 w-6" />
            </div>
          </Card>
        ))}
      </div>

      {/* Workforce Board widgets */}
      {user?.role !== 'CLIENT' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-3.5 p-4.5">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold shrink-0">
              {teamMembers.filter((m) => m.availabilityStatus === 'Available').length}
            </div>
            <div>
              <span className="text-[9px] font-bold text-foreground/50 uppercase tracking-wider block">
                Available Online
              </span>
              <span className="text-xs font-bold text-foreground block">
                {teamMembers.filter((m) => m.availabilityStatus !== 'Offline').length} Online &bull;{' '}
                {teamMembers.length} Total
              </span>
            </div>
          </Card>

          <Card className="flex items-center gap-3.5 p-4.5">
            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] font-bold text-foreground/50 uppercase tracking-wider block">
                Today's Meetings
              </span>
              <span className="text-xs font-bold text-foreground block">
                {meetings.length} Scheduled
              </span>
            </div>
          </Card>

          <Card className="flex items-center gap-3.5 p-4.5">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] font-bold text-foreground/50 uppercase tracking-wider block">
                Hours Tracked Today
              </span>
              <span className="text-xs font-bold text-foreground block">
                {hoursToday} hrs logged
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Main Layout Blocks */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="grid gap-6">
          {/* Top Projects */}
          <Card>
            <h2 className="text-lg font-bold text-foreground">Active Projects</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 font-semibold text-foreground/75">
                    <th className="px-4 py-2.5">Project</th>
                    <th className="px-4 py-2.5">Client</th>
                    <th className="px-4 py-2.5">Progress</th>
                    <th className="px-4 py-2.5">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-foreground/55">
                        Loading...
                      </td>
                    </tr>
                  ) : projects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-foreground/55">
                        No projects registered yet.
                      </td>
                    </tr>
                  ) : (
                    projects.slice(0, 5).map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-semibold block">{p.projectName}</span>
                            <span className="text-[10px] text-foreground/50 font-mono">
                              {p.projectCode}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground/80 font-medium">
                          {p.client?.companyName}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 rounded-full bg-border overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${p.progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold">{p.progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              p.healthStatus === 'HEALTHY'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : p.healthStatus === 'AT_RISK'
                                  ? 'bg-orange-500/10 text-orange-600'
                                  : 'bg-danger/10 text-danger'
                            }`}
                          >
                            {p.healthStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* CRM Stats Card */}
          <Card className="flex items-center justify-between p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Total Managed Clients
                </span>
                <span className="text-2xl font-bold text-foreground">
                  {loading ? '...' : totalClients} ({activeClients} Active)
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar: Upcoming Milestones & Activities */}
        <div className="grid gap-6">
          {/* Upcoming Milestones */}
          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-foreground">Upcoming Milestones</h2>
            <div className="grid gap-3 mt-2">
              {loading ? (
                <div className="text-sm text-foreground/50">Loading milestones...</div>
              ) : sortedMilestones.length === 0 ? (
                <div className="text-xs text-foreground/50 italic">No upcoming milestones.</div>
              ) : (
                sortedMilestones.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-1 bg-muted/20 p-2.5 rounded-lg border border-border/50 text-xs"
                  >
                    <div className="flex justify-between font-semibold">
                      <span>{m.title}</span>
                      <span className="text-primary text-[10px] uppercase font-mono">
                        {m.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-foreground/50">{m.prjName}</span>
                    <span className="text-[10px] text-foreground/60 mt-1 flex items-center gap-1 font-medium">
                      <Clock className="h-3 w-3" /> Due: {new Date(m.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Recent Activities */}
          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5">
              <Activity className="h-5 w-5 text-primary" /> Recent Project Activity
            </h2>
            <div className="relative border-l border-border pl-4 ml-2 mt-2 flex flex-col gap-4 text-xs">
              {loading ? (
                <div className="text-sm text-foreground/50">Loading activities...</div>
              ) : sortedActivities.length === 0 ? (
                <div className="text-foreground/50 italic pl-1">No activities logged yet.</div>
              ) : (
                sortedActivities.map((act, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[21px] top-1 bg-background border border-primary h-2 w-2 rounded-full" />
                    <div>
                      <span className="block font-semibold text-foreground/80 leading-normal">
                        {act.desc}
                      </span>
                      <span className="text-[10px] text-foreground/50 mt-0.5 block">
                        {act.prjName} &bull; {new Date(act.time).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
