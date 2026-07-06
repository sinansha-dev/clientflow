import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import type { TimeLog, Meeting, Task, Project } from '@clientflow/types';
import {
  Briefcase,
  Calendar,
  Clock,
  Compass,
  FileText,
  Mail,
  Shield,
  User,
  Activity,
  Plus,
  Tag,
  Clock3,
  Award,
  Video,
  CheckCircle,
} from 'lucide-react';

interface TeamMemberDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  role: string;
  status: string;
  employeeId?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  skills: string[];
  hourlyRate?: number | null;
  employmentType?: string | null;
  joinDate?: string | null;
  availabilityStatus: string;
  timezone: string;
  manager?: { id: string; firstName: string; lastName: string } | null;
  projectTeams: Array<{ role: string; project: Project }>;
  assignedTasks: Task[];
  timeLogs: TimeLog[];
  meetingsAttending: Array<{ meeting: Meeting; attendanceStatus: string }>;
  metrics: {
    weeklyHours: number;
    billableHours: number;
    utilization: number;
  };
}

export function TeamProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [member, setMember] = useState<TeamMemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'projects' | 'tasks' | 'timelogs' | 'meetings' | 'performance'
  >('overview');

  // Skill edit toggles
  const [editingSkills, setEditingSkills] = useState(false);
  const [skillsInput, setSkillsInput] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [profileForm, setProfileForm] = useState({
    jobTitle: '',
    department: '',
    hourlyRate: 0,
    employmentType: 'Full-Time',
    availabilityStatus: 'Offline',
    timezone: 'UTC',
  });

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/team/${id}`);
      const m = res.data.data as TeamMemberDetail;
      setMember(m);

      setProfileForm({
        jobTitle: m.jobTitle ?? '',
        department: m.department ?? '',
        hourlyRate: m.hourlyRate ?? 0,
        employmentType: m.employmentType ?? 'Full-Time',
        availabilityStatus: m.availabilityStatus ?? 'Offline',
        timezone: m.timezone ?? 'UTC',
      });
      setSkillsInput(m.skills?.join(', ') ?? '');
    } catch (err) {
      notify({ type: 'error', title: 'Load Failed', message: errorMessage(err) });
      navigate('/team');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadProfile();
  }, [id]);

  if (loading || !member) {
    return (
      <div className="py-12 text-center text-sm text-foreground/50">
        Loading team member profile workspace...
      </div>
    );
  }

  const isSelf = currentUser?.id === member.id;
  const isAdmin = currentUser?.role === 'ADMIN';
  const canEdit = isAdmin || isSelf;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/team/${member.id}`, profileForm);
      notify({ type: 'success', title: 'Profile Updated' });
      setEditingProfile(false);
      loadProfile();
    } catch (err) {
      notify({ type: 'error', title: 'Update Failed', message: errorMessage(err) });
    }
  };

  const handleSkillsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const skillsArray = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      await api.patch(`/team/${member.id}`, { skills: skillsArray });
      notify({ type: 'success', title: 'Skills updated' });
      setEditingSkills(false);
      loadProfile();
    } catch (err) {
      notify({ type: 'error', title: 'Failed to update skills', message: errorMessage(err) });
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/team/${member.id}/reset-password`, { password: resetPassword });
      notify({ type: 'success', title: 'Password reset successfully' });
      setResetPassword('');
      setShowPasswordReset(false);
    } catch (err) {
      notify({ type: 'error', title: 'Password reset failed', message: errorMessage(err) });
    }
  };

  // Determine workload indicators
  const tasksDueToday = member.assignedTasks?.filter((t) => {
    if (!t.dueDate || t.status === 'COMPLETED') return false;
    const due = new Date(t.dueDate).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    return due === today;
  }).length;

  const isOverloaded =
    member.assignedTasks?.filter((t) => t.status !== 'COMPLETED').length > 8 ||
    member.metrics.weeklyHours > 45;

  return (
    <div className="grid gap-6">
      {/* Top Banner Card */}
      <Card className="flex flex-col md:flex-row gap-5 items-center md:items-start text-center md:text-left">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center font-bold text-3xl text-primary shrink-0">
          {member.firstName.charAt(0)}
          {member.lastName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-center md:justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {member.firstName} {member.lastName}
              </h2>
              <span className="text-xs text-foreground/50 font-semibold block">
                {member.jobTitle || 'Team Member'} &bull; {member.department || 'Staff'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Button onClick={() => setEditingProfile(!editingProfile)} className="h-9 text-xs">
                  {editingProfile ? 'Cancel Edit' : 'Edit Profile Parameters'}
                </Button>
              )}
              {isAdmin && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowPasswordReset(!showPasswordReset)}
                  className="h-9 text-xs"
                >
                  Reset Password
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-4 flex-wrap text-xs text-foreground/55 pt-1">
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" /> {member.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" />
              Role: <strong>{member.role}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Compass className="h-4 w-4" /> Timezone: {member.timezone}
            </span>
            <span className="flex items-center gap-1">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  member.availabilityStatus === 'Available' ? 'bg-emerald-500' : 'bg-orange-500'
                }`}
              />
              {member.availabilityStatus}
            </span>
          </div>
        </div>
      </Card>

      {showPasswordReset && isAdmin && (
        <Card className="border border-secondary/20 bg-secondary/5">
          <h3 className="text-sm font-bold mb-4">Reset Member Password</h3>
          <form
            onSubmit={handlePasswordReset}
            className="grid gap-4 sm:grid-cols-[1fr_auto] text-xs"
          >
            <div className="grid gap-1">
              <label className="font-semibold">New Password</label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="h-10 rounded border border-border bg-background px-3 outline-none"
                placeholder="Minimum 6 characters"
                required
                minLength={6}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowPasswordReset(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetPassword.length < 6}>
                Reset
              </Button>
            </div>
          </form>
        </Card>
      )}
      {/* EDIT PROFILE DRAWER FORM */}
      {editingProfile && (
        <Card className="border border-primary/20 bg-primary/5">
          <h3 className="text-sm font-bold mb-4">Edit Profile details</h3>
          <form
            onSubmit={handleProfileSubmit}
            className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-xs"
          >
            <div className="grid gap-1">
              <label className="font-semibold">Job Title</label>
              <input
                type="text"
                value={profileForm.jobTitle}
                onChange={(e) => setProfileForm({ ...profileForm, jobTitle: e.target.value })}
                className="h-10 rounded border border-border bg-background px-3 outline-none"
              />
            </div>

            <div className="grid gap-1">
              <label className="font-semibold">Department</label>
              <input
                type="text"
                value={profileForm.department}
                onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                className="h-10 rounded border border-border bg-background px-3 outline-none"
              />
            </div>

            <div className="grid gap-1">
              <label className="font-semibold">Hourly Rate (Snapshot Rate)</label>
              <input
                type="number"
                value={profileForm.hourlyRate}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, hourlyRate: parseFloat(e.target.value) || 0 })
                }
                className="h-10 rounded border border-border bg-background px-3 outline-none"
                disabled={!isAdmin} // Only admin can set payment scales
              />
            </div>

            <div className="grid gap-1">
              <label className="font-semibold">Employment Type</label>
              <select
                value={profileForm.employmentType}
                onChange={(e) => setProfileForm({ ...profileForm, employmentType: e.target.value })}
                className="h-10 rounded border border-border bg-background px-3"
              >
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Freelancer">Freelancer</option>
                <option value="Contractor">Contractor</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="font-semibold">Availability Status</label>
              <select
                value={profileForm.availabilityStatus}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, availabilityStatus: e.target.value })
                }
                className="h-10 rounded border border-border bg-background px-3"
              >
                <option value="Available">Available</option>
                <option value="Busy">Busy</option>
                <option value="In Meeting">In Meeting</option>
                <option value="On Leave">On Leave</option>
                <option value="Offline">Offline</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="font-semibold">Timezone</label>
              <input
                type="text"
                value={profileForm.timezone}
                onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })}
                className="h-10 rounded border border-border bg-background px-3 outline-none"
              />
            </div>

            <div className="flex gap-2 justify-end sm:col-span-2 md:col-span-3 mt-2">
              <Button type="button" variant="ghost" onClick={() => setEditingProfile(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabs Header Navigation */}
      <div className="flex border-b border-border text-xs font-semibold overflow-x-auto gap-4">
        {(
          [
            { id: 'overview', label: 'Overview', icon: Briefcase },
            { id: 'projects', label: 'Projects', icon: Compass },
            { id: 'tasks', label: 'Tasks', icon: Clock },
            { id: 'timelogs', label: 'Time Logs', icon: Clock3 },
            { id: 'meetings', label: 'Meetings', icon: Calendar },
            { id: 'performance', label: 'Performance', icon: Award },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 py-3 border-b-2 font-bold px-1 transition shrink-0 ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground/50 hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Workspaces */}
      <div className="grid gap-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left Card: Workload & Overload status */}
            <Card className="md:col-span-2 flex flex-col gap-4">
              <h3 className="text-sm font-bold flex justify-between items-center">
                Workload capacity
                {isOverloaded && (
                  <span className="text-[10px] font-bold bg-danger/10 text-danger px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    Overloaded
                  </span>
                )}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2 text-xs">
                <div className="bg-muted/15 p-3.5 rounded-lg border border-border/30">
                  <span className="text-foreground/50 block font-bold">Current Projects</span>
                  <span className="text-2xl font-bold block mt-1">
                    {member.projectTeams?.length}
                  </span>
                </div>
                <div className="bg-muted/15 p-3.5 rounded-lg border border-border/30">
                  <span className="text-foreground/50 block font-bold">Active Issues</span>
                  <span className="text-2xl font-bold block mt-1">
                    {member.assignedTasks?.filter((t) => t.status !== 'COMPLETED').length}
                  </span>
                </div>
                <div className="bg-muted/15 p-3.5 rounded-lg border border-border/30">
                  <span className="text-foreground/50 block font-bold">Hours Tracked (Weekly)</span>
                  <span className="text-2xl font-bold block mt-1">
                    {member.metrics.weeklyHours} hrs
                  </span>
                </div>
                <div className="bg-muted/15 p-3.5 rounded-lg border border-border/30">
                  <span className="text-foreground/50 block font-bold">Utilization Rate</span>
                  <span className="text-2xl font-bold block mt-1">
                    {member.metrics.utilization}%
                  </span>
                </div>
              </div>

              {/* Progress bars visualizer */}
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-bold">
                    <span>Weekly Target Hours (Capacity 40h)</span>
                    <span>{Math.round((member.metrics.weeklyHours / 40) * 100)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full ${member.metrics.weeklyHours > 40 ? 'bg-danger' : 'bg-primary'}`}
                      style={{
                        width: `${Math.min(100, (member.metrics.weeklyHours / 40) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Right Card: Skills profile */}
            <Card className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold flex items-center gap-1">
                  <Tag className="h-4.5 w-4.5 text-primary" /> Skills Tags
                </h3>
                {canEdit && (
                  <button
                    onClick={() => setEditingSkills(!editingSkills)}
                    className="text-xs text-primary hover:underline font-bold"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingSkills ? (
                <form onSubmit={handleSkillsSubmit} className="space-y-2">
                  <input
                    type="text"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    placeholder="React, Node.js, Express"
                    className="w-full h-10 rounded border border-border bg-background px-3 text-xs outline-none"
                  />
                  <div className="flex gap-1.5 justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setEditingSkills(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="h-8 text-xs">
                      Save
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {member.skills?.length === 0 ? (
                    <span className="text-xs text-foreground/45 italic">No skills catalogued</span>
                  ) : (
                    member.skills?.map((sk) => (
                      <span
                        key={sk}
                        className="bg-muted px-2.5 py-1 rounded text-xs font-semibold text-foreground/75 border border-border/40"
                      >
                        {sk}
                      </span>
                    ))
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* PROJECTS TAB */}
        {activeTab === 'projects' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {member.projectTeams?.length === 0 ? (
              <Card className="col-span-full py-12 text-center text-foreground/40 italic">
                No active projects assigned.
              </Card>
            ) : (
              member.projectTeams?.map((t) => (
                <Card key={t.project.id} className="flex justify-between items-center">
                  <div>
                    <Link
                      to={`/projects/${t.project.id}`}
                      className="font-bold text-sm text-primary hover:underline"
                    >
                      {t.project.projectName}
                    </Link>
                    <span className="text-[10px] text-foreground/50 block font-mono mt-0.5">
                      Code: {t.project.projectCode} &bull; Status: {t.project.status}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-foreground/60 bg-muted px-2.5 py-0.5 rounded">
                    {t.role}
                  </span>
                </Card>
              ))
            )}
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div className="grid gap-3">
            {member.assignedTasks?.length === 0 ? (
              <Card className="py-12 text-center text-foreground/40 italic">
                No tasks currently assigned.
              </Card>
            ) : (
              member.assignedTasks?.map((task) => (
                <Card key={task.id} className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-foreground/80 text-sm block">{task.title}</span>
                    <span className="text-[10px] text-foreground/45 mt-0.5 block font-mono">
                      Project: {task.project?.projectName}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="bg-muted px-2 py-0.5 rounded font-semibold text-[10px]">
                      {task.status}
                    </span>
                    <span className="bg-orange-500/10 text-orange-500 font-bold px-2 py-0.5 rounded text-[10px]">
                      {task.priority}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* TIME LOGS TAB */}
        {activeTab === 'timelogs' && (
          <Card className="p-0 overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/40 border-b border-border font-bold text-foreground/75">
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Hours</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Logged Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {member.timeLogs?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-foreground/45 italic">
                      No time entries logged.
                    </td>
                  </tr>
                ) : (
                  member.timeLogs?.map((log) => (
                    <tr key={log.id}>
                      <td className="px-5 py-3.5 font-semibold text-foreground/85">
                        {log.description}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="block font-semibold">{log.project?.projectName}</span>
                        <span className="text-[10px] text-foreground/45 font-mono">
                          {log.project?.projectCode}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-primary">{log.duration} hrs</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : log.status === 'SUBMITTED'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-slate-400/10 text-slate-500'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-foreground/50">
                        {new Date(log.startTime).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        )}

        {/* MEETINGS TAB */}
        {activeTab === 'meetings' && (
          <div className="grid gap-3">
            {member.meetingsAttending?.length === 0 ? (
              <Card className="py-12 text-center text-foreground/40 italic">
                No upcoming meetings scheduled.
              </Card>
            ) : (
              member.meetingsAttending?.map(({ meeting, attendanceStatus }) => (
                <Card key={meeting.id} className="flex justify-between items-center text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-sm block flex items-center gap-1.5">
                      {meeting.title}
                    </span>
                    <span className="text-[10px] text-foreground/50 block">
                      Platform: <strong>{meeting.platform}</strong> &bull; Host:{' '}
                      {meeting.organizer?.firstName}
                    </span>
                    <span className="text-[10px] text-primary font-semibold block">
                      {new Date(meeting.startTime).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="bg-muted px-2 py-0.5 rounded font-bold text-[10px]">
                      RSVP: {attendanceStatus}
                    </span>
                    {meeting.meetingLink && (
                      <a
                        href={meeting.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1 rounded-md font-bold flex items-center gap-1"
                      >
                        <Video className="h-3.5 w-3.5" /> Join Meet
                      </a>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === 'performance' && (
          <Card className="grid gap-6 sm:grid-cols-3 text-center text-xs">
            <div className="p-4 bg-muted/10 border rounded-lg">
              <span className="block font-bold text-foreground/50 mb-1">Time Logs Status</span>
              <span className="text-xl font-bold text-primary block mt-1">
                {member.timeLogs?.filter((l) => l.status === 'APPROVED').length} Approved
              </span>
            </div>
            <div className="p-4 bg-muted/10 border rounded-lg">
              <span className="block font-bold text-foreground/50 mb-1">Completed Issues</span>
              <span className="text-xl font-bold text-emerald-600 block mt-1">
                {member.assignedTasks?.filter((t) => t.status === 'COMPLETED').length} Closed
              </span>
            </div>
            <div className="p-4 bg-muted/10 border rounded-lg">
              <span className="block font-bold text-foreground/50 mb-1">Hourly Target Rate</span>
              <span className="text-xl font-bold text-foreground block mt-1">
                ${member.hourlyRate || 0}/hr
              </span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
