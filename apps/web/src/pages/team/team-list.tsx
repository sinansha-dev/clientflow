import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import { projectRoleLabels } from '@clientflow/shared';
import type { ProjectRole } from '@clientflow/types';
import { Link } from 'react-router-dom';
import { Search, Plus, Power, PowerOff } from 'lucide-react';

interface TeamMemberSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
  role: string;
  status: string;
  employeeId?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  skills: string[];
  availabilityStatus: string;
  projectsCount: number;
  assignedProjects: Array<{
    projectId: string;
    projectRole: ProjectRole;
    project: { id: string; projectName: string; projectCode: string };
  }>;
  activeTasksCount: number;
  weeklyHours: number;
}

export function TeamListPage() {
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [members, setMembers] = useState<TeamMemberSummary[]>([]);
  const [, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('ALL');
  const [availability, setAvailability] = useState('ALL');
  const [role, setRole] = useState('ALL');
  const [skills, setSkills] = useState('ALL');

  // Invitation state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteMode, setInviteMode] = useState<'INVITE' | 'MANUAL'>('INVITE');
  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'STAFF',
    jobTitle: '',
    department: '',
    password: '',
    employeeId: '',
    hourlyRate: '',
    employmentType: 'Full-Time',
    timezone: 'UTC',
    skills: [] as string[],
  });

  const loadTeam = async () => {
    try {
      setLoading(true);
      const qParams = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        search,
        department,
        availability,
        role,
        skills,
      });
      const res = await api.get(`/team?${qParams.toString()}`);
      setMembers(res.data.data.items ?? []);
      setTotal(res.data.data.total ?? 0);
      setTotalPages(res.data.data.totalPages ?? 1);
    } catch (err) {
      notify({ type: 'error', title: 'Load Failed', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, [page, department, availability, role, skills]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadTeam();
  };

  // Status updates
  const handleToggleDeactivate = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (
      !window.confirm(
        `Are you sure you want to set this team member status to ${nextStatus.toLowerCase()}?`,
      )
    )
      return;

    try {
      await api.patch(`/team/${id}/status`, { status: nextStatus });
      notify({ type: 'success', title: 'Status updated' });
      loadTeam();
    } catch (err) {
      notify({ type: 'error', title: 'Action Failed', message: errorMessage(err) });
    }
  };

  // Invite submission
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (inviteMode === 'INVITE') {
        const res = await api.post('/team/invite', {
          email: inviteForm.email,
          firstName: inviteForm.firstName,
          lastName: inviteForm.lastName,
          role: inviteForm.role,
          jobTitle: inviteForm.jobTitle,
          department: inviteForm.department,
        });
        notify({
          type: 'success',
          title: 'Invitation Sent',
          message: `Simulation invitation logged. Link: ${res.data.data.invitationLink}`,
        });
      } else {
        await api.post('/team', {
          email: inviteForm.email,
          password: inviteForm.password,
          firstName: inviteForm.firstName,
          lastName: inviteForm.lastName,
          role: inviteForm.role,
          jobTitle: inviteForm.jobTitle,
          department: inviteForm.department,
          employeeId: inviteForm.employeeId,
          hourlyRate: inviteForm.hourlyRate,
          employmentType: inviteForm.employmentType,
          timezone: inviteForm.timezone,
          skills: inviteForm.skills,
        });
        notify({
          type: 'success',
          title: 'Member Created',
          message: 'Team member created successfully',
        });
      }
      setShowInviteModal(false);
      setInviteForm({
        email: '',
        firstName: '',
        lastName: '',
        role: 'STAFF',
        jobTitle: '',
        department: '',
        password: '',
        employeeId: '',
        hourlyRate: '',
        employmentType: 'Full-Time',
        timezone: 'UTC',
        skills: [],
      });
      loadTeam();
    } catch (err) {
      notify({ type: 'error', title: 'Action Failed', message: errorMessage(err) });
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  // Extract skills lists dynamically
  const availableSkills = [
    'React',
    'Next.js',
    'Node.js',
    'Express',
    'Laravel',
    'PostgreSQL',
    'Docker',
    'AWS',
    'UI/UX',
    'DevOps',
    'QA',
  ];

  return (
    <div className="grid gap-6">
      {/* Title Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Workforce Directory</h1>
          <p className="text-sm text-foreground/50 mt-1">
            Manage Staff profiles, project responsibilities, workloads, and availability.
          </p>
        </div>

        {isAdmin && (
          <Button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Invite Member
          </Button>
        )}
      </div>

      {/* Roster Filters */}
      <Card className="grid gap-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, job title..."
              className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 border-t border-border pt-4 text-xs font-semibold">
          <div className="grid gap-1">
            <label className="text-foreground/50">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-9 rounded border border-border bg-background px-2"
            >
              <option value="ALL">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Design">Design</option>
              <option value="Marketing">Marketing</option>
              <option value="Product">Product</option>
              <option value="QA">QA</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-foreground/50">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-9 rounded border border-border bg-background px-2"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-foreground/50">Availability</label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="h-9 rounded border border-border bg-background px-2"
            >
              <option value="ALL">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Busy">Busy</option>
              <option value="In Meeting">In Meeting</option>
              <option value="On Leave">On Leave</option>
              <option value="Offline">Offline</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-foreground/50">Filter by Skill</label>
            <select
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="h-9 rounded border border-border bg-background px-2"
            >
              <option value="ALL">All Skills</option>
              {availableSkills.map((sk) => (
                <option key={sk} value={sk}>
                  {sk}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Team directory */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border bg-muted/20 text-xs uppercase text-foreground/50">
              <tr>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Global Role</th>
                <th className="px-5 py-3.5">Assigned Projects</th>
                <th className="px-5 py-3.5">Project Roles</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-foreground/45">
                    Loading team directory...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-foreground/45">
                    No Staff members matched the filters.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="align-middle hover:bg-muted/10">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {member.firstName.charAt(0)}
                            {member.lastName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <Link
                            to={'/team/' + member.id}
                            className="block truncate font-semibold hover:text-primary"
                          >
                            {member.firstName} {member.lastName}
                          </Link>
                          <span className="block truncate text-xs text-foreground/45">
                            {member.jobTitle || member.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded border border-border bg-muted/30 px-2 py-1 text-xs font-bold">
                        {member.role === 'STAFF' ? 'Staff' : 'Admin'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold">{member.projectsCount}</span>
                      <span className="ml-1 text-foreground/45">
                        {member.projectsCount === 1 ? 'project' : 'projects'}
                      </span>
                      {member.assignedProjects?.length > 0 && (
                        <p
                          className="mt-1 max-w-[220px] truncate text-xs text-foreground/45"
                          title={member.assignedProjects
                            .map((assignment) => assignment.project.projectName)
                            .join(', ')}
                        >
                          {member.assignedProjects
                            .map((assignment) => assignment.project.projectName)
                            .join(', ')}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-[280px] flex-wrap gap-1">
                        {member.assignedProjects?.length ? (
                          member.assignedProjects.map((assignment) => (
                            <span
                              key={assignment.projectId}
                              title={assignment.project.projectName}
                              className="rounded border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary"
                            >
                              {projectRoleLabels[assignment.projectRole]}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-foreground/35">Not assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            'h-2 w-2 rounded-full ' +
                            (member.status !== 'ACTIVE'
                              ? 'bg-slate-400'
                              : member.availabilityStatus === 'Available'
                                ? 'bg-emerald-500'
                                : member.availabilityStatus === 'Busy' ||
                                    member.availabilityStatus === 'In Meeting'
                                  ? 'bg-orange-500'
                                  : 'bg-slate-400')
                          }
                        />
                        <div>
                          <span className="block text-xs font-semibold">
                            {member.status === 'ACTIVE' ? member.availabilityStatus : 'Suspended'}
                          </span>
                          <span className="text-[10px] text-foreground/40">
                            {member.activeTasksCount} active tasks / {member.weeklyHours}h this week
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isAdmin && (
                        <button
                          type="button"
                          title={
                            member.status === 'ACTIVE' ? 'Deactivate member' : 'Activate member'
                          }
                          onClick={() => handleToggleDeactivate(member.id, member.status)}
                          className={
                            'inline-flex rounded-md p-2 transition ' +
                            (member.status === 'ACTIVE'
                              ? 'text-danger hover:bg-danger/10'
                              : 'text-emerald-600 hover:bg-emerald-500/10')
                          }
                        >
                          {member.status === 'ACTIVE' ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* INVITE / MANUAL CREATE MEMBER MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl p-6 relative">
            <div className="flex border-b border-border mb-4 text-xs font-semibold">
              <button
                type="button"
                className={`flex-1 pb-2 border-b-2 transition ${
                  inviteMode === 'INVITE'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground/50'
                }`}
                onClick={() => setInviteMode('INVITE')}
              >
                Send Invitation Link
              </button>
              <button
                type="button"
                className={`flex-1 pb-2 border-b-2 transition ${
                  inviteMode === 'MANUAL'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground/50'
                }`}
                onClick={() => setInviteMode('MANUAL')}
              >
                Create Member Manually
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="grid gap-3 text-xs">
              <div className="grid gap-1">
                <label className="font-semibold">Email Address *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="name@company.com"
                  className="h-10 rounded border border-border bg-background px-3 outline-none"
                  required
                />
              </div>

              {inviteMode === 'MANUAL' && (
                <div className="grid gap-1">
                  <label className="font-semibold">Initial Password *</label>
                  <input
                    type="password"
                    value={inviteForm.password}
                    onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                    placeholder="Min 6 characters"
                    className="h-10 rounded border border-border bg-background px-3 outline-none"
                    required
                    minLength={6}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="font-semibold">First Name *</label>
                  <input
                    type="text"
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                    className="h-10 rounded border border-border bg-background px-3 outline-none"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <label className="font-semibold">Last Name *</label>
                  <input
                    type="text"
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                    className="h-10 rounded border border-border bg-background px-3 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="font-semibold">Role *</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    className="h-10 rounded border border-border bg-background px-3"
                    required
                  >
                    <option value="STAFF">Staff</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="grid gap-1">
                  <label className="font-semibold">Employment Type</label>
                  <select
                    value={inviteForm.employmentType}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, employmentType: e.target.value })
                    }
                    className="h-10 rounded border border-border bg-background px-3"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Freelancer">Freelancer</option>
                    <option value="Contractor">Contractor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="font-semibold">Job Title</label>
                  <input
                    type="text"
                    value={inviteForm.jobTitle}
                    onChange={(e) => setInviteForm({ ...inviteForm, jobTitle: e.target.value })}
                    placeholder="e.g. Senior Frontend Dev"
                    className="h-10 rounded border border-border bg-background px-3 outline-none"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="font-semibold">Department</label>
                  <input
                    type="text"
                    value={inviteForm.department}
                    onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                    placeholder="e.g. Engineering"
                    className="h-10 rounded border border-border bg-background px-3 outline-none"
                  />
                </div>
              </div>

              {inviteMode === 'MANUAL' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <label className="font-semibold">Employee ID</label>
                    <input
                      type="text"
                      value={inviteForm.employeeId}
                      onChange={(e) => setInviteForm({ ...inviteForm, employeeId: e.target.value })}
                      placeholder="e.g. EMP-101"
                      className="h-10 rounded border border-border bg-background px-3 outline-none"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="font-semibold">Hourly Rate ($)</label>
                    <input
                      type="number"
                      value={inviteForm.hourlyRate}
                      onChange={(e) => setInviteForm({ ...inviteForm, hourlyRate: e.target.value })}
                      placeholder="e.g. 50"
                      className="h-10 rounded border border-border bg-background px-3 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="ghost" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {inviteMode === 'INVITE' ? 'Send Invitation' : 'Create Member'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
