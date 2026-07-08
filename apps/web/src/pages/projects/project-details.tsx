import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { TasksBoard } from '../tasks/tasks-board';
import { TasksListPage } from '../tasks/tasks-list';
import { TasksCalendar } from '../tasks/tasks-calendar';
import { TasksDashboard } from '../tasks/tasks-dashboard';
import { Kanban, ListTodo, LayoutDashboard } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import type { Project, Milestone, ProjectNote, AuthUser, Meeting } from '@clientflow/types';
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Folder,
  Milestone as MilestoneIcon,
  Plus,
  Rocket,
  Settings,
  Shield,
  Upload,
  User,
  Video,
  RotateCcw,
  FolderOpen,
} from 'lucide-react';

type ProjectTab =
  | 'overview'
  | 'milestones'
  | 'tasks'
  | 'files'
  | 'meetings'
  | 'timelogs'
  | 'invoices'
  | 'deployments'
  | 'notes'
  | 'activity';

export function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [tasksViewMode, setTasksViewMode] = useState<'board' | 'list' | 'calendar' | 'dashboard'>(
    'board',
  );

  // Load staff for PM/team assignment editing
  const [staff, setStaff] = useState<AuthUser[]>([]);

  // Modals & Panels inline states
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Project>>({});

  // Team Assignments Inline State
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({ userId: '', role: 'Frontend Developer' });

  // Milestone Inline State
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    status: 'PENDING',
  });

  // Note Inline State
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFolder, setUploadFolder] = useState('DOCUMENTS');
  const [, setUploading] = useState(false);

  // Deployment Inline State
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [deployForm, setDeployForm] = useState({
    environment: 'Staging',
    repositoryUrl: '',
    hostingProvider: 'Vercel',
    branch: 'main',
    commitHash: '',
    productionUrl: '',
    stagingUrl: '',
    status: 'SUCCESS',
    version: '1.0.0',
  });

  const linkedMeetings = project?.meetingsLinked ?? [];
  const legacyMeetings = project?.meetings ?? [];
  const timeLogs = project?.timeLogs ?? [];
  const approvedTimeLogs = timeLogs.filter((log) => log.status === 'APPROVED');
  const approvedHours = approvedTimeLogs.reduce((sum, log) => sum + Number(log.duration || 0), 0);
  const approvedBillableValue = approvedTimeLogs
    .filter((log) => log.billable)
    .reduce((sum, log) => sum + Number(log.duration || 0) * Number(log.hourlyRateSnapshot || 0), 0);

  const statusBadgeClass = (status: string) =>
    status === 'APPROVED'
      ? 'bg-emerald-500/10 text-emerald-600'
      : status === 'SUBMITTED'
        ? 'bg-primary/10 text-primary'
        : status === 'REJECTED'
          ? 'bg-danger/10 text-danger'
          : 'bg-slate-400/10 text-slate-500';

  const formatUserName = (person?: AuthUser | null) =>
    person ? `${person.firstName} ${person.lastName}` : 'Unassigned';

  const formatMeetingTime = (meeting: Meeting) => {
    const start = new Date(meeting.startTime);
    const end = new Date(meeting.endTime);
    return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const loadProjectDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/${id}`);
      setProject(response.data.data);
      if (response.data.data) {
        setEditForm(response.data.data);
      }
    } catch (err) {
      notify({
        type: 'error',
        title: 'Error Loading Project',
        message: errorMessage(err, 'Failed to retrieve project details'),
      });
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadProjectDetails();
    }
  }, [id]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      const loadStaff = async () => {
        try {
          const res = await api.get('/users');
          setStaff((res.data.data?.users ?? []).filter((u: AuthUser) => u.role !== 'CLIENT'));
        } catch (err) {
          console.error(err);
        }
      };
      loadStaff();
    }
  }, [user]);

  if (loading) {
    return <div className="py-12 text-center text-foreground/50">Loading project details...</div>;
  }

  if (!project) {
    return <div className="py-12 text-center text-foreground/50">Project not found.</div>;
  }

  const isAdmin = user?.role === 'ADMIN';

  // --- Calculations ---
  const deadline = new Date(project.deadline);
  const now = new Date();
  const timeDiff = deadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  // --- Project Actions ---
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        projectName: editForm.projectName,
        description: editForm.description,
        status: editForm.status,
        priority: editForm.priority,
        budget: editForm.budget,
        estimatedHours: editForm.estimatedHours,
        actualHours: editForm.actualHours,
        deadline: editForm.deadline,
        projectManagerId: editForm.projectManagerId,
      };
      const response = await api.patch(`/projects/${id}`, payload);
      setProject(response.data.data);
      setIsEditingInfo(false);
      notify({ type: 'success', title: 'Project Updated' });
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Update Failed', message: errorMessage(err) });
    }
  };

  const handleArchiveRestore = async () => {
    const isCompleted = project.status === 'COMPLETED';
    const action = isCompleted ? 'restore' : 'archive';
    if (
      !window.confirm(
        `Are you sure you want to ${isCompleted ? 'restore' : 'complete & archive'} this project?`,
      )
    )
      return;

    try {
      await api.post(`/projects/${id}/${action}`);
      notify({ type: 'success', title: `Project ${isCompleted ? 'Restored' : 'Completed'}` });
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Operation Failed', message: errorMessage(err) });
    }
  };

  // --- Team Assignment Actions ---
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberForm.userId) return;
    try {
      await api.post(`/projects/${id}/team`, newMemberForm);
      notify({ type: 'success', title: 'Team Member Assigned' });
      setShowAddMember(false);
      setNewMemberForm({ userId: '', role: 'Frontend Developer' });
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Assign Failed', message: errorMessage(err) });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) return;
    try {
      await api.delete(`/projects/${id}/team/${memberId}`);
      notify({ type: 'success', title: 'Member Removed' });
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Remove Failed', message: errorMessage(err) });
    }
  };

  // --- Milestone Actions ---
  const handleMilestoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMilestone) {
        await api.patch(`/projects/milestones/${editingMilestone.id}`, milestoneForm);
        notify({ type: 'success', title: 'Milestone Updated' });
      } else {
        await api.post(`/projects/${id}/milestones`, milestoneForm);
        notify({ type: 'success', title: 'Milestone Created' });
      }
      setShowMilestoneForm(false);
      setEditingMilestone(null);
      setMilestoneForm({ title: '', description: '', dueDate: '', status: 'PENDING' });
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Action Failed', message: errorMessage(err) });
    }
  };

  const startEditMilestone = (m: Milestone) => {
    setEditingMilestone(m);
    setMilestoneForm({
      title: m.title,
      description: m.description ?? '',
      dueDate: new Date(m.dueDate).toISOString().split('T')[0] || '',
      status: m.status,
    });
    setShowMilestoneForm(true);
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;
    try {
      await api.delete(`/projects/milestones/${milestoneId}`);
      notify({ type: 'success', title: 'Milestone Deleted' });
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Delete Failed', message: errorMessage(err) });
    }
  };

  // --- Note Actions ---
  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    try {
      if (editingNoteId) {
        await api.patch(`/projects/notes/${editingNoteId}`, { note: noteContent });
        notify({ type: 'success', title: 'Note Updated' });
      } else {
        await api.post(`/projects/${id}/notes`, { note: noteContent });
        notify({ type: 'success', title: 'Note Added' });
      }
      setNoteContent('');
      setEditingNoteId(null);
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Save Failed', message: errorMessage(err) });
    }
  };

  const startEditNote = (n: ProjectNote) => {
    setEditingNoteId(n.id);
    setNoteContent(n.note);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await api.delete(`/projects/notes/${noteId}`);
      notify({ type: 'success', title: 'Note Deleted' });
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Delete Failed', message: errorMessage(err) });
    }
  };

  // --- Deployment Actions ---
  const handleDeploySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${id}/deployments`, deployForm);
      notify({ type: 'success', title: 'Deployment Logged' });
      setShowDeployForm(false);
      setDeployForm({
        environment: 'Staging',
        repositoryUrl: '',
        hostingProvider: 'Vercel',
        branch: 'main',
        commitHash: '',
        productionUrl: '',
        stagingUrl: '',
        status: 'SUCCESS',
        version: '1.0.0',
      });
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Deployment Save Failed', message: errorMessage(err) });
    }
  };

  const handleDeleteDeployment = async (deployId: string) => {
    if (!window.confirm('Are you sure you want to delete this deployment entry?')) return;
    try {
      await api.delete(`/projects/deployments/${deployId}`);
      notify({ type: 'success', title: 'Deployment Deleted' });
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Delete Failed', message: errorMessage(err) });
    }
  };

  // --- File Actions ---
  const triggerFileUpload = (folder: string) => {
    setUploadFolder(folder);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', uploadFolder);

    try {
      setUploading(true);
      await api.post(`/projects/${id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify({ type: 'success', title: 'File Uploaded', message: `Uploaded to ${uploadFolder}` });
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Upload Failed', message: errorMessage(err) });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    try {
      await api.delete(`/projects/files/${fileId}`);
      notify({ type: 'success', title: 'File Deleted' });
      loadProjectDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Delete Failed', message: errorMessage(err) });
    }
  };

  return (
    <div className="grid gap-6">
      {/* Title block */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/projects')} className="p-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {project.projectName}
              <span className="text-xs font-mono font-normal text-foreground/45">
                ({project.projectCode})
              </span>
            </h1>
            <p className="text-xs text-foreground/60">
              Client: <span className="font-semibold">{project.client?.companyName}</span>
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handleArchiveRestore}
              className="flex items-center gap-2"
            >
              {project.status === 'COMPLETED' ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              {project.status === 'COMPLETED' ? 'Mark Active' : 'Mark Completed'}
            </Button>
            <Button
              onClick={() => setIsEditingInfo(!isEditingInfo)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" /> Settings
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto text-sm font-semibold">
        {(
          [
            { id: 'overview', label: 'Overview', icon: FolderOpen },
            { id: 'milestones', label: 'Milestones', icon: MilestoneIcon },
            { id: 'tasks', label: 'Tasks', icon: FileText },
            { id: 'files', label: 'Files', icon: Upload },
            { id: 'meetings', label: 'Meetings', icon: Video },
            { id: 'timelogs', label: 'Time Logs', icon: Clock },
            isAdmin && { id: 'invoices', label: 'Invoices', icon: DollarSign },
            { id: 'deployments', label: 'Deployments', icon: Rocket },
            { id: 'notes', label: 'Notes', icon: Shield },
            { id: 'activity', label: 'Activity', icon: Clock },
          ].filter(Boolean) as any[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6">
        {/* --- EDIT SETTINGS PANEL --- */}
        {isEditingInfo && (
          <Card className="border border-primary/20 bg-primary/5">
            <h2 className="text-base font-bold mb-4">Edit Project Settings</h2>
            <form onSubmit={handleUpdateProject} className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Project Name"
                value={editForm.projectName || ''}
                onChange={(e) => setEditForm({ ...editForm, projectName: e.target.value })}
              />
              <div className="grid gap-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  value={editForm.status || 'PLANNING'}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="PLANNING">Planning</option>
                  <option value="DEVELOPMENT">Development</option>
                  <option value="TESTING">Testing</option>
                  <option value="CLIENT_REVIEW">Client Review</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ON_HOLD">On Hold</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Priority</label>
                <select
                  value={editForm.priority || 'MEDIUM'}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                  className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <Input
                label="Budget ($)"
                type="number"
                value={editForm.budget || 0}
                onChange={(e) => setEditForm({ ...editForm, budget: parseFloat(e.target.value) })}
              />
              <Input
                label="Estimated Hours"
                type="number"
                value={editForm.estimatedHours || 0}
                onChange={(e) =>
                  setEditForm({ ...editForm, estimatedHours: parseFloat(e.target.value) })
                }
              />
              <Input
                label="Actual Hours"
                type="number"
                value={editForm.actualHours || 0}
                onChange={(e) =>
                  setEditForm({ ...editForm, actualHours: parseFloat(e.target.value) })
                }
              />
              <Input
                label="Deadline"
                type="date"
                value={
                  editForm.deadline ? new Date(editForm.deadline).toISOString().split('T')[0] : ''
                }
                onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
              />

              {isAdmin && (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Project Manager</label>
                  <select
                    value={editForm.projectManagerId || ''}
                    onChange={(e) => setEditForm({ ...editForm, projectManagerId: e.target.value })}
                    className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Choose manager...</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setIsEditingInfo(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Card>
        )}

        {/* --- OVERVIEW TAB --- */}
        {activeTab === 'overview' && (
          <div className={`grid gap-6 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {/* Countdown / Health */}
            <Card className="flex flex-col gap-4 justify-between bg-primary/5 border border-primary/10">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                  Project status
                </span>
                <div className="mt-4 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      project.healthStatus === 'HEALTHY'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : project.healthStatus === 'AT_RISK'
                          ? 'bg-orange-500/10 text-orange-600'
                          : 'bg-danger/10 text-danger'
                    }`}
                  >
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-2xl font-bold text-foreground">
                      {project.healthStatus}
                    </span>
                    <span className="text-xs text-foreground/50">
                      {daysRemaining > 0
                        ? `${daysRemaining} days remaining`
                        : daysRemaining === 0
                          ? 'Due today'
                          : `Overdue by ${Math.abs(daysRemaining)} days`}
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="block text-xs font-semibold text-foreground/60 mb-1">
                    Overall Progress
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold">{project.progress}%</span>
                  </div>
                </div>
              </div>
            </Card>

            {isAdmin && (
              <Card className="flex flex-col gap-4 justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                    Financials
                  </span>
                  <div className="mt-4">
                    <span className="text-xs text-foreground/50 block">Project Budget</span>
                    <span className="text-2xl font-bold text-foreground">
                      ${project.budget.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-foreground/50 block">Spent so far</span>
                    <span className="text-base font-bold text-foreground/75">
                      $
                      {approvedBillableValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            <Card className="flex flex-col gap-4 justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                  Timeline
                </span>
                <div className="mt-4">
                  <span className="text-xs text-foreground/50 block">Start Date & Deadline</span>
                  <span className="font-semibold text-foreground">
                    {new Date(project.startDate).toLocaleDateString()} &mdash;{' '}
                    {new Date(project.deadline).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-xs text-foreground/50 block">
                    Estimated vs Logged Hours
                  </span>
                  <span className="font-semibold text-foreground">
                    {project.estimatedHours} hrs vs {project.actualHours} hrs
                  </span>
                </div>
              </div>
            </Card>

            {/* Team Members List */}
            <Card className="md:col-span-2 grid gap-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold">Assigned Team Members</h3>
                {isAdmin && (
                  <Button
                    onClick={() => setShowAddMember(!showAddMember)}
                    className="h-8 px-2.5 text-xs border border-border bg-transparent"
                  >
                    + Add Member
                  </Button>
                )}
              </div>

              {showAddMember && (
                <form
                  onSubmit={handleAddMember}
                  className="flex gap-2 items-end bg-muted/10 p-3 rounded-lg border border-border mb-2"
                >
                  <div className="grid gap-1 flex-1">
                    <label className="text-xs font-semibold text-foreground/60">
                      Choose Member
                    </label>
                    <select
                      value={newMemberForm.userId}
                      onChange={(e) =>
                        setNewMemberForm({ ...newMemberForm, userId: e.target.value })
                      }
                      className="h-10 rounded-md border border-border bg-background px-3 text-xs"
                      required
                    >
                      <option value="">Select Staff...</option>
                      {staff
                        .filter((s) => !project.teamMembers?.some((tm) => tm.userId === s.id))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.firstName} {s.lastName}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="grid gap-1 w-48">
                    <label className="text-xs font-semibold text-foreground/60">Role</label>
                    <select
                      value={newMemberForm.role}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, role: e.target.value })}
                      className="h-10 rounded-md border border-border bg-background px-3 text-xs"
                    >
                      <option value="Frontend Developer">Frontend</option>
                      <option value="Backend Developer">Backend</option>
                      <option value="Full Stack Developer">Full Stack</option>
                      <option value="UI/UX Designer">UI/UX</option>
                      <option value="QA Tester">QA Tester</option>
                      <option value="DevOps">DevOps</option>
                    </select>
                  </div>
                  <Button type="submit">Assign</Button>
                </form>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {project.teamMembers?.map((tm) => (
                  <div
                    key={tm.userId}
                    className="flex items-center justify-between border border-border p-3 rounded-lg bg-card"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {tm.user?.firstName.charAt(0)}
                      </div>
                      <div>
                        <span className="block font-semibold text-sm">
                          {tm.user?.firstName} {tm.user?.lastName}
                        </span>
                        <span className="text-xs text-foreground/50">{tm.role}</span>
                      </div>
                    </div>
                    {isAdmin && tm.role !== 'Project Manager' && (
                      <button
                        onClick={() => handleRemoveMember(tm.userId)}
                        className="p-1.5 text-danger hover:bg-danger/10 rounded-md text-xs"
                        type="button"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* General Info */}
            <Card className="grid gap-4">
              <h3 className="text-base font-bold">Project Details</h3>
              <p className="text-sm leading-relaxed text-foreground/80">{project.description}</p>
            </Card>
          </div>
        )}

        {/* --- MILESTONES TAB --- */}
        {activeTab === 'milestones' && (
          <div className="grid gap-6">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-foreground">Project Milestones</h3>
              <Button
                onClick={() => setShowMilestoneForm(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add Milestone
              </Button>
            </div>

            {showMilestoneForm && (
              <Card className="border border-primary/20 bg-primary/5">
                <h4 className="text-sm font-bold mb-4">
                  {editingMilestone ? 'Edit Milestone' : 'Add New Milestone'}
                </h4>
                <form onSubmit={handleMilestoneSubmit} className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Milestone Title *"
                    value={milestoneForm.title}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                    required
                  />
                  <Input
                    label="Due Date *"
                    type="date"
                    value={milestoneForm.dueDate}
                    onChange={(e) =>
                      setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })
                    }
                    required
                  />
                  <div className="grid gap-2 sm:col-span-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      value={milestoneForm.description}
                      onChange={(e) =>
                        setMilestoneForm({ ...milestoneForm, description: e.target.value })
                      }
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                      rows={2}
                    />
                  </div>
                  {editingMilestone && (
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Status</label>
                      <select
                        value={milestoneForm.status}
                        onChange={(e) =>
                          setMilestoneForm({ ...milestoneForm, status: e.target.value })
                        }
                        className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2 justify-end sm:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowMilestoneForm(false);
                        setEditingMilestone(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save Milestone</Button>
                  </div>
                </form>
              </Card>
            )}

            <div className="grid gap-4">
              {project.milestones?.length === 0 ? (
                <div className="text-center py-6 text-foreground/50">
                  No milestones registered yet.
                </div>
              ) : (
                project.milestones?.map((m) => (
                  <Card
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-4"
                  >
                    <div>
                      <span className="font-bold text-foreground block">{m.title}</span>
                      <span className="text-xs text-foreground/60 block mt-1">{m.description}</span>
                      <span className="text-xs text-foreground/50 block mt-1 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Due:{' '}
                        {new Date(m.dueDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        onClick={async () => {
                          // Easy toggle to completed
                          const nextStatus = m.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
                          await api.patch(`/projects/milestones/${m.id}`, { status: nextStatus });
                          loadProjectDetails();
                        }}
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer transition select-none ${
                          m.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                            : m.status === 'IN_PROGRESS'
                              ? 'bg-primary/10 text-primary hover:bg-primary/20'
                              : 'bg-muted text-foreground/60 hover:bg-muted/80'
                        }`}
                      >
                        {m.status}
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          variant="ghost"
                          onClick={() => startEditMilestone(m)}
                          className="h-8 px-2.5 text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteMilestone(m.id)}
                          className="h-8 px-2.5 text-xs text-danger hover:bg-danger/10"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- TASKS TAB --- */}
        {activeTab === 'tasks' && (
          <div className="grid gap-6">
            {/* View toggle tabs */}
            <div className="flex justify-end">
              <div className="flex border border-border bg-card rounded-lg p-1 text-xs font-semibold">
                {(
                  [
                    { id: 'board', label: 'Kanban Board', icon: Kanban },
                    { id: 'list', label: 'List View', icon: ListTodo },
                    { id: 'calendar', label: 'Calendar', icon: Calendar },
                    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTasksViewMode(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                      tasksViewMode === tab.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground/60 hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected view mode */}
            <div className="min-w-0">
              {tasksViewMode === 'board' && <TasksBoard projectId={project.id} />}
              {tasksViewMode === 'list' && <TasksListPage projectId={project.id} />}
              {tasksViewMode === 'calendar' && <TasksCalendar projectId={project.id} />}
              {tasksViewMode === 'dashboard' && <TasksDashboard projectId={project.id} />}
            </div>
          </div>
        )}

        {/* --- FILES TAB --- */}
        {activeTab === 'files' && (
          <div className="grid gap-6">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.zip"
            />

            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              {(
                [
                  'DESIGN',
                  'SOURCE_CODE',
                  'CONTRACTS',
                  'ASSETS',
                  'DOCUMENTS',
                  'DELIVERABLES',
                ] as const
              ).map((folder) => {
                const folderFiles = project.files?.filter((f) => f.folder === folder) ?? [];
                return (
                  <Card key={folder} className="flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-border pb-2">
                      <span className="font-bold text-sm flex items-center gap-1.5 capitalize text-primary">
                        <Folder className="h-4 w-4" /> {folder.replace('_', ' ').toLowerCase()}
                      </span>
                      <button
                        onClick={() => triggerFileUpload(folder)}
                        className="text-xs font-semibold text-primary hover:underline"
                        type="button"
                      >
                        + Upload
                      </button>
                    </div>

                    <div className="flex-1 grid gap-2 py-1 max-h-48 overflow-y-auto">
                      {folderFiles.length === 0 ? (
                        <span className="text-xs text-foreground/40 italic">Empty folder</span>
                      ) : (
                        folderFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex justify-between items-center text-xs bg-muted/30 p-1.5 rounded border border-border/50"
                          >
                            <a
                              href={`${api.defaults.baseURL || ''}${file.url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium truncate flex-1 hover:underline text-foreground/80"
                            >
                              {file.name}
                            </a>
                            <button
                              onClick={() => handleDeleteFile(file.id)}
                              className="text-danger p-1 hover:bg-danger/10 rounded ml-1"
                              type="button"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* --- MEETINGS TAB --- */}
        {activeTab === 'meetings' && (
          <div className="grid gap-6">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold">Project Meetings</h3>
            </div>
            {linkedMeetings.length === 0 && legacyMeetings.length === 0 ? (
              <Card className="text-center py-6 text-foreground/45 border border-dashed">
                No meetings scheduled for this project.
              </Card>
            ) : (
              <div className="grid gap-3">
                {linkedMeetings.map((meeting) => (
                  <Card key={meeting.id} className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-foreground">{meeting.title}</h4>
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {meeting.meetingType}
                          </span>
                        </div>
                        {meeting.description && (
                          <p className="mt-1 text-sm text-foreground/60">{meeting.description}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-foreground/55">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatMeetingTime(meeting)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {formatUserName(meeting.organizer)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Video className="h-3.5 w-3.5" />
                            {meeting.platform}
                          </span>
                        </div>
                      </div>
                      {meeting.meetingLink && (
                        <a
                          href={meeting.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 shrink-0 items-center justify-center rounded border border-border px-3 text-xs font-bold text-primary hover:bg-primary/10"
                        >
                          Join
                        </a>
                      )}
                    </div>
                    {meeting.participants && meeting.participants.length > 0 && (
                      <div className="mt-3 border-t border-border pt-3 text-xs text-foreground/55">
                        Participants:{' '}
                        {meeting.participants
                          .map((participant) => formatUserName(participant.user))
                          .join(', ')}
                      </div>
                    )}
                  </Card>
                ))}

                {legacyMeetings.map((meeting) => (
                  <Card key={meeting.id} className="p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h4 className="font-bold text-foreground">{meeting.title}</h4>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-foreground/55">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(meeting.date).toLocaleString()}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Video className="h-3.5 w-3.5" />
                            {meeting.platform}
                          </span>
                        </div>
                        {meeting.notes && (
                          <p className="mt-2 text-sm text-foreground/60">{meeting.notes}</p>
                        )}
                      </div>
                      <span className="rounded bg-muted px-2 py-1 text-xs font-semibold text-foreground/60">
                        {meeting.participants}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- TIMELOGS TAB --- */}
        {activeTab === 'timelogs' && (
          <Card className="p-0 overflow-hidden text-xs">
            <div className="flex justify-between items-center border-b border-border px-5 py-4">
              <h3 className="font-bold text-sm">Project Time Logs</h3>
            </div>

            <div
              className={`grid gap-3 border-b border-border px-5 py-4 ${isAdmin ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}
            >
              <div className="rounded border border-border bg-background p-3">
                <span className="block text-[10px] font-bold uppercase text-foreground/45">
                  Approved Hours
                </span>
                <span className="mt-1 block text-xl font-bold text-primary">
                  {approvedHours.toFixed(2)} hrs
                </span>
              </div>
              {isAdmin && (
                <div className="rounded border border-border bg-background p-3">
                  <span className="block text-[10px] font-bold uppercase text-foreground/45">
                    Approved Billable Value
                  </span>
                  <span className="mt-1 block text-xl font-bold text-emerald-600">
                    ${approvedBillableValue.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/30 border-b border-border font-bold text-foreground/75">
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Team Member</th>
                    <th className="px-5 py-3">Task</th>
                    <th className="px-5 py-3">Hours</th>
                    {isAdmin && <th className="px-5 py-3">Value</th>}
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {timeLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdmin ? 7 : 6}
                        className="px-5 py-8 text-center text-foreground/45 italic"
                      >
                        No time entries logged for this project.
                      </td>
                    </tr>
                  ) : (
                    timeLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/10 transition">
                        <td className="px-5 py-3.5">
                          <span className="font-semibold block text-foreground/90">
                            {log.description}
                          </span>
                          {log.billable && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1 rounded-sm mt-0.5">
                              <DollarSign className="h-2.5 w-2.5" /> Billable
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-semibold">{formatUserName(log.user)}</td>
                        <td className="px-5 py-3.5 text-foreground/55">
                          {log.task?.title || 'No task linked'}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-primary">{log.duration} hrs</td>
                        {isAdmin && (
                          <td className="px-5 py-3.5 font-bold text-emerald-600">
                            {log.billable
                              ? `$${(Number(log.duration || 0) * Number(log.hourlyRateSnapshot || 0)).toLocaleString()}`
                              : '-'}
                          </td>
                        )}
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusBadgeClass(log.status)}`}
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
            </div>
          </Card>
        )}

        {/* --- INVOICES TAB --- */}
        {activeTab === 'invoices' && isAdmin && (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 font-semibold text-foreground/80">
                    <th className="px-6 py-4">Invoice Number</th>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Balance</th>
                    <th className="px-6 py-4">Due Date</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {project.invoices?.length ? (
                    project.invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-border">
                        <td className="px-6 py-4 font-bold">{invoice.invoiceNumber}</td>
                        <td className="px-6 py-4">{invoice.client?.companyName}</td>
                        <td className="px-6 py-4">
                          {invoice.currency} {invoice.total.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {invoice.currency} {invoice.balanceDue.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-bold text-primary">{invoice.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-foreground/45">
                        No invoices found for this project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* --- DEPLOYMENTS TAB --- */}
        {activeTab === 'deployments' && (
          <div className="grid gap-6">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold">Hosting & Deployments</h3>
              <Button onClick={() => setShowDeployForm(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Log Deployment
              </Button>
            </div>

            {showDeployForm && (
              <Card className="border border-primary/20 bg-primary/5">
                <h4 className="text-sm font-bold mb-4">Log New Deployment</h4>
                <form onSubmit={handleDeploySubmit} className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Environment *</label>
                    <select
                      value={deployForm.environment}
                      onChange={(e) =>
                        setDeployForm({ ...deployForm, environment: e.target.value })
                      }
                      className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="Production">Production</option>
                      <option value="Staging">Staging</option>
                      <option value="Development">Development</option>
                    </select>
                  </div>
                  <Input
                    label="Repository URL *"
                    value={deployForm.repositoryUrl}
                    onChange={(e) =>
                      setDeployForm({ ...deployForm, repositoryUrl: e.target.value })
                    }
                    placeholder="https://github.com/clientflow/app"
                    required
                  />
                  <Input
                    label="Hosting Provider *"
                    value={deployForm.hostingProvider}
                    onChange={(e) =>
                      setDeployForm({ ...deployForm, hostingProvider: e.target.value })
                    }
                    placeholder="e.g. AWS, Vercel, Netlify"
                    required
                  />
                  <Input
                    label="Git Branch *"
                    value={deployForm.branch}
                    onChange={(e) => setDeployForm({ ...deployForm, branch: e.target.value })}
                    placeholder="e.g. main, dev"
                    required
                  />
                  <Input
                    label="Commit Hash"
                    value={deployForm.commitHash}
                    onChange={(e) => setDeployForm({ ...deployForm, commitHash: e.target.value })}
                    placeholder="e.g. d6f3a1"
                  />
                  <Input
                    label="Version *"
                    value={deployForm.version}
                    onChange={(e) => setDeployForm({ ...deployForm, version: e.target.value })}
                    placeholder="e.g. 1.0.4"
                    required
                  />
                  <Input
                    label="Production URL"
                    value={deployForm.productionUrl}
                    onChange={(e) =>
                      setDeployForm({ ...deployForm, productionUrl: e.target.value })
                    }
                  />
                  <Input
                    label="Staging URL"
                    value={deployForm.stagingUrl}
                    onChange={(e) => setDeployForm({ ...deployForm, stagingUrl: e.target.value })}
                  />
                  <div className="flex gap-2 justify-end sm:col-span-2">
                    <Button type="button" variant="ghost" onClick={() => setShowDeployForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Log Deploy</Button>
                  </div>
                </form>
              </Card>
            )}

            <div className="grid gap-4">
              {project.deployments?.length === 0 ? (
                <div className="text-center py-6 text-foreground/50 border border-dashed">
                  No deployments logged.
                </div>
              ) : (
                project.deployments?.map((d) => (
                  <Card key={d.id} className="grid gap-3 p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-primary flex items-center gap-1.5">
                        <Rocket className="h-4 w-4" /> {d.environment} (v{d.version})
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => handleDeleteDeployment(d.id)}
                        className="text-danger hover:bg-danger/10 h-8 px-2.5 text-xs"
                      >
                        Delete
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 text-xs border-t border-border pt-3">
                      <div>
                        <span className="font-semibold text-foreground/60 block">
                          Repository / Branch
                        </span>
                        <span>
                          {d.repositoryUrl} ({d.branch})
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-foreground/60 block">
                          Hosting Provider
                        </span>
                        <span>{d.hostingProvider}</span>
                      </div>
                      {d.productionUrl && (
                        <div>
                          <span className="font-semibold text-foreground/60 block">
                            Production URL
                          </span>
                          <a
                            href={d.productionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {d.productionUrl}
                          </a>
                        </div>
                      )}
                      {d.stagingUrl && (
                        <div>
                          <span className="font-semibold text-foreground/60 block">
                            Staging URL
                          </span>
                          <a
                            href={d.stagingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {d.stagingUrl}
                          </a>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- NOTES TAB --- */}
        {activeTab === 'notes' && (
          <div className="grid gap-6">
            <h3 className="text-base font-bold text-foreground">Project Notes</h3>

            <Card className="flex flex-col gap-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/65">
                {editingNoteId
                  ? 'Edit Internal Note'
                  : 'Add Note / API details / Hosting Credentials'}
              </h4>
              <form onSubmit={handleNoteSubmit} className="flex flex-col gap-3">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Type project documentation, Hosting credentials, API notes here..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  rows={4}
                  required
                />
                <div className="flex gap-2 justify-end">
                  {editingNoteId && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditingNoteId(null);
                        setNoteContent('');
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button type="submit">{editingNoteId ? 'Save Edit' : 'Add Note'}</Button>
                </div>
              </form>
            </Card>

            <div className="grid gap-4">
              {project.notes?.length === 0 ? (
                <div className="text-center py-6 text-foreground/50">No notes written yet.</div>
              ) : (
                project.notes?.map((note) => (
                  <Card key={note.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-foreground/50 border-b border-border pb-2">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground/75">
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px]">
                          {note.user?.firstName.charAt(0)}
                        </div>
                        <span>
                          {note.user?.firstName} {note.user?.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                        {(note.userId === user?.id || isAdmin) && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditNote(note)}
                              className="text-primary hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-danger hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="whitespace-pre-line text-sm text-foreground/90 mt-1">
                      {note.note}
                    </p>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- ACTIVITY TIMELINE --- */}
        {activeTab === 'activity' && (
          <div className="grid gap-6">
            <h3 className="text-base font-bold text-foreground">Project Activity Timeline</h3>
            <div className="relative border-l border-border pl-6 ml-3 flex flex-col gap-6">
              {project.activities?.length === 0 ? (
                <div className="text-sm text-foreground/50 pl-2">No activity recorded.</div>
              ) : (
                project.activities?.map((act) => (
                  <div key={act.id} className="relative text-sm">
                    <div className="absolute -left-[31px] top-1 bg-background border-2 border-primary h-4 w-4 rounded-full" />
                    <div>
                      <span className="block font-semibold text-foreground">{act.description}</span>
                      <span className="text-xs text-foreground/50">
                        {act.type} • {new Date(act.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
