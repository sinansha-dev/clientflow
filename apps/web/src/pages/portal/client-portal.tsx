import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FolderPlus,
  Send,
  UploadCloud,
  CheckCircle2,
  RotateCcw,
  Video,
  FileText,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToastStore } from '../../stores/toast-store';

type PortalProject = {
  id: string;
  projectName: string;
  status: string;
  progress: number;
  deadline: string;
  healthStatus: string;
  client?: { companyName: string };
  projectManager?: { firstName: string; lastName: string; email?: string };
  milestones?: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string;
    progress: number;
  }>;
  files?: PortalFile[];
  approvals?: Approval[];
  revisionRequests?: Revision[];
  portalMessages?: PortalMessage[];
  meetingsLinked?: Meeting[];
  portalActivities?: Activity[];
};

type PortalFile = {
  id: string;
  name: string;
  originalFileName?: string;
  type: string;
  size: number;
  url: string;
  visibility: string;
  deliverableStatus: string;
  version: number;
  downloadCount: number;
  createdAt: string;
  uploadedBy?: { firstName: string; lastName: string };
};

type Approval = {
  id: string;
  status: string;
  comments?: string;
  deliverable: PortalFile;
  createdAt: string;
};
type Revision = {
  id: string;
  status: string;
  priority: string;
  description: string;
  deliverable: PortalFile;
  createdAt: string;
};
type PortalMessage = {
  id: string;
  body: string;
  internalOnly: boolean;
  createdAt: string;
  author: { firstName: string; lastName: string; role: string };
};
type Meeting = {
  id: string;
  title: string;
  startTime?: string;
  date?: string;
  meetingLink?: string;
  platform?: string;
  description?: string;
};
type Activity = {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  user?: { firstName: string; lastName: string };
};

type Dashboard = {
  metrics: Record<string, number>;
  projects: PortalProject[];
  pendingApprovals: Approval[];
  recentFiles: PortalFile[];
  recentMessages: PortalMessage[];
  upcomingMeetings: Meeting[];
};

const tabs = [
  'overview',
  'milestones',
  'files',
  'approvals',
  'messages',
  'meetings',
  'activity',
] as const;
type Tab = (typeof tabs)[number];

function formatDate(value?: string) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleDateString();
}

function fileSize(size: number) {
  if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function ClientPortalPage() {
  const notify = useToastStore((state) => state.notify);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => localStorage.getItem('client-portal-project-id') || '',
  );
  const [project, setProject] = useState<PortalProject | null>(null);
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [folderName, setFolderName] = useState('');
  const [uploading, setUploading] = useState(false);

  async function loadDashboard() {
    const [dashboardRes, projectsRes] = await Promise.all([
      api.get('/portal/dashboard'),
      api.get('/portal/projects'),
    ]);
    const loadedDashboard = dashboardRes.data.data as Dashboard;
    const loadedProjects = projectsRes.data.data.projects as PortalProject[];
    setDashboard(loadedDashboard);
    setProjects(loadedProjects);
    const initialPrjId = localStorage.getItem('client-portal-project-id');
    if (initialPrjId && loadedProjects.some((p) => p.id === initialPrjId)) {
      setSelectedProjectId(initialPrjId);
    } else if (loadedProjects[0]) {
      setSelectedProjectId(loadedProjects[0].id);
    }
  }

  async function loadProject(projectId: string) {
    const [projectRes, filesRes] = await Promise.all([
      api.get(`/portal/projects/${projectId}`),
      api.get(`/projects/${projectId}/files`),
    ]);
    setProject(projectRes.data.data.project);
    setFiles(filesRes.data.data.files);
  }

  useEffect(() => {
    setLoading(true);
    loadDashboard()
      .catch((err) =>
        notify({ type: 'error', title: 'Portal load failed', message: errorMessage(err) }),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    localStorage.setItem('client-portal-project-id', selectedProjectId);
    loadProject(selectedProjectId).catch((err) =>
      notify({ type: 'error', title: 'Project load failed', message: errorMessage(err) }),
    );
  }, [selectedProjectId]);

  const metrics = dashboard?.metrics ?? {};
  const nextMilestone = useMemo(
    () => project?.milestones?.find((item) => item.status !== 'COMPLETED'),
    [project],
  );

  async function handleUpload(file: File) {
    if (!selectedProjectId) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'CLIENT_PORTAL');
    formData.append('visibility', 'CLIENT');
    formData.append('deliverableStatus', 'READY_FOR_REVIEW');
    setUploading(true);
    try {
      await api.post(`/projects/${selectedProjectId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify({ type: 'success', title: 'File uploaded', message: file.name });
      await loadProject(selectedProjectId);
    } catch (err) {
      notify({ type: 'error', title: 'Upload failed', message: errorMessage(err) });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload(file: PortalFile) {
    try {
      const res = await api.get(`/files/${file.id}/download`);
      window.open(
        `${api.defaults.baseURL ?? ''}${res.data.data.downloadUrl}`,
        '_blank',
        'noopener,noreferrer',
      );
    } catch (err) {
      notify({ type: 'error', title: 'Download failed', message: errorMessage(err) });
    }
  }

  async function handleApprove(approvalId: string) {
    try {
      await api.post(`/approvals/${approvalId}/approve`, { comments: 'Approved from portal' });
      notify({ type: 'success', title: 'Deliverable approved' });
      if (selectedProjectId) await loadProject(selectedProjectId);
    } catch (err) {
      notify({ type: 'error', title: 'Approval failed', message: errorMessage(err) });
    }
  }

  async function handleRevision(approval: Approval) {
    const description = window.prompt('Describe the requested revision');
    if (!description) return;
    try {
      await api.post(`/approvals/${approval.id}/request-revision`, {
        description,
        priority: 'MEDIUM',
      });
      notify({ type: 'success', title: 'Revision requested' });
      if (selectedProjectId) await loadProject(selectedProjectId);
    } catch (err) {
      notify({ type: 'error', title: 'Revision failed', message: errorMessage(err) });
    }
  }

  async function sendMessage() {
    if (!message.trim() || !selectedProjectId) return;
    try {
      await api.post('/messages', { projectId: selectedProjectId, body: message.trim() });
      setMessage('');
      await loadProject(selectedProjectId);
    } catch (err) {
      notify({ type: 'error', title: 'Message failed', message: errorMessage(err) });
    }
  }

  async function createFolder() {
    if (!folderName.trim() || !selectedProjectId) return;
    try {
      await api.post('/folders', { projectId: selectedProjectId, folderName: folderName.trim() });
      setFolderName('');
      notify({ type: 'success', title: 'Folder created' });
    } catch (err) {
      notify({ type: 'error', title: 'Folder failed', message: errorMessage(err) });
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Client Portal</h1>
          <p className="mt-2 text-foreground/65">
            Shared project visibility, deliverables, messages, meetings, and approvals.
          </p>
        </div>
        <select
          className="h-11 rounded-md border border-border bg-background px-3 text-sm"
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
        >
          {projects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.projectName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ['Active Projects', metrics.activeProjects],
          ['Pending Reviews', metrics.pendingReviews],
          ['Files Shared', metrics.filesShared],
          ['Meetings', metrics.upcomingMeetings],
          ['Invoices', metrics.outstandingInvoices],
          ['Messages', metrics.latestMessages],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-foreground/60">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-primary">{value ?? 0}</p>
          </Card>
        ))}
      </div>

      {project ? (
        <div className="grid gap-5">
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-foreground/60">{project.client?.companyName}</p>
                <h2 className="text-2xl font-semibold">{project.projectName}</h2>
                <p className="mt-2 text-sm text-foreground/65">
                  Manager: {project.projectManager?.firstName} {project.projectManager?.lastName}
                </p>
              </div>
              <div className="min-w-56">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          <div className="flex gap-2 overflow-x-auto border-b border-border">
            {tabs.map((item) => (
              <button
                key={item}
                className={`px-3 py-2 text-sm font-medium capitalize ${tab === item ? 'border-b-2 border-primary text-primary' : 'text-foreground/60'}`}
                onClick={() => setTab(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <p className="text-sm text-foreground/60">Deadline</p>
                <p className="mt-2 text-lg font-semibold">{formatDate(project.deadline)}</p>
              </Card>
              <Card>
                <p className="text-sm text-foreground/60">Status</p>
                <p className="mt-2 text-lg font-semibold">{project.status}</p>
              </Card>
              <Card>
                <p className="text-sm text-foreground/60">Next milestone</p>
                <p className="mt-2 text-lg font-semibold">
                  {nextMilestone?.title ?? 'No pending milestones'}
                </p>
              </Card>
            </div>
          )}

          {tab === 'milestones' && (
            <Card>
              <div className="grid gap-3">
                {project.milestones?.map((item) => (
                  <div key={item.id} className="rounded-md border border-border p-3">
                    <div className="flex justify-between">
                      <strong>{item.title}</strong>
                      <span>{item.status}</span>
                    </div>
                    <p className="text-sm text-foreground/60">
                      Due {formatDate(item.dueDate)} � {item.progress}%
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'files' && (
            <Card>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-2">
                  <Input
                    label="Folder"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="Design Assets"
                  />
                  <Button type="button" variant="ghost" onClick={createFolder}>
                    <FolderPlus className="h-4 w-4" />
                    Create
                  </Button>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    className="hidden"
                    type="file"
                    multiple
                    onChange={(e) => Array.from(e.target.files ?? []).forEach(handleUpload)}
                  />
                  <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud className="h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Upload files'}
                  </Button>
                </div>
              </div>
              <div className="grid gap-3">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-col gap-3 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{file.name}</p>
                      <p className="text-xs text-foreground/60">
                        {file.type} � {fileSize(file.size)} � v{file.version} � {file.visibility} �{' '}
                        {file.downloadCount} downloads
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => handleDownload(file)}>
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'approvals' && (
            <Card>
              <div className="grid gap-3">
                {project.approvals?.map((approval) => (
                  <div key={approval.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold">{approval.deliverable.name}</p>
                        <p className="text-xs text-foreground/60">
                          {approval.status} � {formatDate(approval.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleApprove(approval.id)}>
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button variant="ghost" onClick={() => handleRevision(approval)}>
                          <RotateCcw className="h-4 w-4" />
                          Revision
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'messages' && (
            <Card>
              <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1">
                {project.portalMessages?.map((item) => (
                  <div key={item.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-semibold">
                      {item.author.firstName} {item.author.lastName}
                    </p>
                    <p className="mt-1 text-sm text-foreground/75">{item.body}</p>
                    <p className="mt-2 text-xs text-foreground/50">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write a project message..."
                />
                <Button onClick={sendMessage}>
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              </div>
            </Card>
          )}

          {tab === 'meetings' && (
            <Card>
              <div className="grid gap-3">
                {project.meetingsLinked?.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between rounded-md border border-border p-3"
                  >
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-foreground/60">
                        {formatDate(item.startTime ?? item.date)} � {item.platform}
                      </p>
                    </div>
                    {item.meetingLink ? (
                      <a
                        className="text-sm font-medium text-primary"
                        href={item.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Video className="mr-1 inline h-4 w-4" />
                        Join
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'activity' && (
            <Card>
              <div className="grid gap-3">
                {project.portalActivities?.map((item) => (
                  <div key={item.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-semibold">
                      <FileText className="mr-2 inline h-4 w-4" />
                      {item.description}
                    </p>
                    <p className="mt-1 text-xs text-foreground/50">
                      {item.type} � {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <p className="text-center text-foreground/60">No portal projects are available yet.</p>
        </Card>
      )}
    </div>
  );
}
