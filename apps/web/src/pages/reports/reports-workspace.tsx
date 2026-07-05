import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useToastStore } from '../../stores/toast-store';
import { errorMessage } from '../../lib/errors';
import type { Project, AuthUser } from '@clientflow/types';
import { FileSpreadsheet, Clock, DollarSign, TrendingUp, Award, Calendar } from 'lucide-react';

interface ReportData {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  productivityPercentage: number;
  billableAmount: number;
}

export function ReportsWorkspacePage() {
  const notify = useToastStore((state) => state.notify);

  const [report, setReport] = useState<ReportData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [team, setTeam] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectId, setProjectId] = useState('ALL');
  const [userId, setUserId] = useState('ALL');

  const loadFilterOptions = async () => {
    try {
      const [prjRes, usrRes] = await Promise.all([
        api.get('/projects?limit=1000'),
        api.get('/users'),
      ]);
      setProjects(prjRes.data.data?.items ?? []);
      setTeam((usrRes.data.data ?? []).filter((u: AuthUser) => u.role !== 'CLIENT'));
    } catch (err) {
      console.error(err);
    }
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      const qParams = new URLSearchParams();
      if (startDate) qParams.append('startDate', startDate);
      if (endDate) qParams.append('endDate', endDate);
      if (projectId !== 'ALL') qParams.append('projectId', projectId);
      if (userId !== 'ALL') qParams.append('userId', userId);

      const res = await api.get(`/timelogs/reports?${qParams.toString()}`);
      setReport(res.data.data);
    } catch (err) {
      notify({ type: 'error', title: 'Load Failed', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, projectId, userId]);

  return (
    <div className="grid gap-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics Reports</h1>
        <p className="text-sm text-foreground/50 mt-1">
          Measure productivity percentages, billable hours allocations, and department capacity
          metrics.
        </p>
      </div>

      {/* Filters Card */}
      <Card className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 text-xs font-semibold">
        <div className="grid gap-1">
          <label className="text-foreground/50">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded border border-border bg-background px-3 outline-none"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-foreground/50">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded border border-border bg-background px-3 outline-none"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-foreground/50">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-9 rounded border border-border bg-background px-2"
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-foreground/50">Team Member</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="h-9 rounded border border-border bg-background px-2"
          >
            <option value="ALL">All Members</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Reports Metrics Renders */}
      {loading || !report ? (
        <div className="py-12 text-center text-sm text-foreground/45">
          Aggregating productivity metrics...
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Card Widgets */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="flex justify-between items-center p-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                  Total Logged Hours
                </span>
                <span className="block text-3xl font-bold text-foreground mt-2">
                  {report.totalHours} hrs
                </span>
              </div>
              <div className="h-11 w-11 rounded-lg bg-muted/40 flex items-center justify-center text-foreground/50">
                <Clock className="h-5.5 w-5.5" />
              </div>
            </Card>

            <Card className="flex justify-between items-center p-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                  Billable Hours
                </span>
                <span className="block text-3xl font-bold text-emerald-600 mt-2">
                  {report.billableHours} hrs
                </span>
              </div>
              <div className="h-11 w-11 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <DollarSign className="h-5.5 w-5.5" />
              </div>
            </Card>

            <Card className="flex justify-between items-center p-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                  Non-Billable Hours
                </span>
                <span className="block text-3xl font-bold text-foreground/75 mt-2">
                  {report.nonBillableHours} hrs
                </span>
              </div>
              <div className="h-11 w-11 rounded-lg bg-muted/40 flex items-center justify-center text-foreground/50">
                <Clock className="h-5.5 w-5.5" />
              </div>
            </Card>

            <Card className="flex justify-between items-center p-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                  Productivity %
                </span>
                <span className="block text-3xl font-bold text-primary mt-2">
                  {report.productivityPercentage}%
                </span>
              </div>
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <TrendingUp className="h-5.5 w-5.5" />
              </div>
            </Card>
          </div>

          {/* Productivity charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="flex flex-col gap-4">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Award className="h-4.5 w-4.5 text-primary" /> Work Distribution
              </h3>
              <div className="space-y-4 text-xs mt-2">
                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span>Billable allocation ({report.billableHours}h)</span>
                    <span>{report.productivityPercentage}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${report.productivityPercentage}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span>Non-Billable allocation ({report.nonBillableHours}h)</span>
                    <span>{100 - report.productivityPercentage}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-slate-400"
                      style={{ width: `${100 - report.productivityPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="flex flex-col gap-4 justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <DollarSign className="h-4.5 w-4.5 text-emerald-500" /> Projected Billable Value
                </h3>
                <p className="text-[11px] text-foreground/50 mt-1">
                  Accumulated invoice value based on employee hourly rates snapshots at logging
                  time.
                </p>
              </div>

              <div className="pt-4">
                <span className="text-[10px] font-bold text-foreground/45 block uppercase tracking-wider">
                  Total Value
                </span>
                <span className="text-4xl font-extrabold text-foreground mt-2 block">
                  ${report.billableAmount}
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
