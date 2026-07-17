import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import type { Client, ClientContact, ClientNote, AuthUser } from '@clientflow/types';
import {
  ArrowLeft,
  Building,
  Clock,
  DollarSign,
  FileText,
  FolderKanban,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  Upload,
  User,
  Users,
  Eye,
  Globe,
  Settings,
  Shield,
  Archive,
  RotateCcw,
  TrendingUp,
  Award,
  Download,
} from 'lucide-react';

type TabType =
  | 'overview'
  | 'contacts'
  | 'projects'
  | 'quotes'
  | 'invoices'
  | 'files'
  | 'notes'
  | 'activity'
  | 'timelogs';

export function ClientDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const isAdmin = user?.role === 'ADMIN';
  const isManager = client ? client.assignedManagerId === user?.id : false;
  const canSeeBilling = isAdmin || isManager;

  useEffect(() => {
    if (activeTab === 'invoices' && !canSeeBilling) {
      setActiveTab('overview');
    }
  }, [activeTab, canSeeBilling]);

  // Edit Client Modal/Inline State
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editClientForm, setEditClientForm] = useState<Partial<Client>>({});
  const [managers, setManagers] = useState<AuthUser[]>([]);

  // Contact Mutates
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    position: '',
    email: '',
    phone: '',
    whatsapp: '',
    primaryContact: false,
  });

  // Note Mutates
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // File Mutates
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Client portal login
  const [showPortalLoginForm, setShowPortalLoginForm] = useState(false);
  const [portalLoginForm, setPortalLoginForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  // Load client details
  const loadClientDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/clients/${id}`);
      setClient(response.data.data);
      if (response.data.data) {
        setEditClientForm(response.data.data);
      }
    } catch (err) {
      notify({
        type: 'error',
        title: 'Error Loading Details',
        message: errorMessage(err, 'Failed to fetch client profile'),
      });
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadClientDetails();
    }
  }, [id]);

  // Load managers for editing client
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      const loadManagers = async () => {
        try {
          const response = await api.get('/users/staff');
          setManagers(response.data.data?.users ?? []);
        } catch (err) {
          console.error(err);
        }
      };
      void loadManagers();
    }
  }, [user]);

  if (loading) {
    return <div className="py-12 text-center text-foreground/50">Loading client details...</div>;
  }

  if (!client) {
    return <div className="py-12 text-center text-foreground/50">Client not found.</div>;
  }

  const clientProjects = client.projects ?? [];
  const activeProjectCount = clientProjects.filter(
    (project) => !['COMPLETED', 'CANCELLED'].includes(project.status),
  ).length;
  const approvedHoursForProject = (project: NonNullable<Client['projects']>[number]) =>
    (project.timeLogs ?? [])
      .filter((log) => log.status === 'APPROVED')
      .reduce((sum, log) => sum + Number(log.duration || 0), 0);
  const approvedValueForProject = (project: NonNullable<Client['projects']>[number]) =>
    (project.timeLogs ?? [])
      .filter((log) => log.status === 'APPROVED' && log.billable)
      .reduce(
        (sum, log) => sum + Number(log.duration || 0) * Number(log.hourlyRateSnapshot || 0),
        0,
      );

  const revenueGenerated =
    client.invoices?.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0) || 0;
  const outstandingBalance =
    client.invoices
      ?.filter((inv) => inv.status !== 'VOID')
      .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0) || 0;
  // --- Client Actions ---
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        companyName: editClientForm.companyName,
        companyLogo: editClientForm.companyLogo || null,
        industry: editClientForm.industry,
        website: editClientForm.website,
        email: editClientForm.email,
        phone: editClientForm.phone,
        assignedManagerId: editClientForm.assignedManagerId || null,
        billingAddress: editClientForm.billingAddress,
        shippingAddress: editClientForm.shippingAddress,
        taxNumber: editClientForm.taxNumber || null,
        currency: editClientForm.currency,
        timezone: editClientForm.timezone,
        source: editClientForm.source || null,
      };
      const response = await api.patch(`/clients/${id}`, payload);
      setClient(response.data.data);
      setIsEditingClient(false);
      notify({
        type: 'success',
        title: 'Client Updated',
        message: 'Company information updated successfully',
      });
      loadClientDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Update Failed', message: errorMessage(err) });
    }
  };

  const handleCreatePortalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/clients/${id}/portal-login`, portalLoginForm);
      setShowPortalLoginForm(false);
      setPortalLoginForm({ email: '', password: '', firstName: '', lastName: '' });
      notify({
        type: 'success',
        title: 'Client Login Created',
        message: 'Client can now log in and access the portal',
      });
      loadClientDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Portal Login Failed', message: errorMessage(err) });
    }
  };
  const handleArchiveRestoreClient = async () => {
    const isArchived = client.status === 'ARCHIVED';
    const action = isArchived ? 'restore' : 'archive';
    if (!window.confirm(`Are you sure you want to ${action} this client?`)) return;

    try {
      await api.post(`/clients/${id}/${action}`);
      notify({
        type: 'success',
        title: `Client ${isArchived ? 'Restored' : 'Archived'}`,
        message: `Client has been ${isArchived ? 'restored' : 'archived'} successfully`,
      });
      loadClientDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Action Failed', message: errorMessage(err) });
    }
  };

  // --- Contact Actions ---
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingContact) {
        // Edit contact
        await api.patch(`/clients/contacts/${editingContact.id}`, contactForm);
        notify({ type: 'success', title: 'Contact Updated' });
      } else {
        // Create contact
        await api.post(`/clients/${id}/contacts`, contactForm);
        notify({ type: 'success', title: 'Contact Added' });
      }
      setShowContactForm(false);
      setEditingContact(null);
      setContactForm({
        name: '',
        position: '',
        email: '',
        phone: '',
        whatsapp: '',
        primaryContact: false,
      });
      loadClientDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Operation Failed', message: errorMessage(err) });
    }
  };

  const startEditContact = (c: ClientContact) => {
    setEditingContact(c);
    setContactForm({
      name: c.name,
      position: c.position,
      email: c.email,
      phone: c.phone,
      whatsapp: c.whatsapp ?? '',
      primaryContact: c.primaryContact,
    });
    setShowContactForm(true);
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    try {
      await api.delete(`/clients/contacts/${contactId}`);
      notify({ type: 'success', title: 'Contact Deleted' });
      loadClientDetails();
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
        await api.patch(`/clients/notes/${editingNoteId}`, { note: noteContent });
        notify({ type: 'success', title: 'Note Updated' });
      } else {
        await api.post(`/clients/${id}/notes`, { note: noteContent });
        notify({ type: 'success', title: 'Note Added' });
      }
      setNoteContent('');
      setEditingNoteId(null);
      loadClientDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Action Failed', message: errorMessage(err) });
    }
  };

  const startEditNote = (n: ClientNote) => {
    setEditingNoteId(n.id);
    setNoteContent(n.note);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this internal note?')) return;
    try {
      await api.delete(`/clients/notes/${noteId}`);
      notify({ type: 'success', title: 'Note Deleted' });
      loadClientDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Delete Failed', message: errorMessage(err) });
    }
  };

  // --- File Actions ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 10MB default
    if (file.size > 10 * 1024 * 1024) {
      notify({ type: 'error', title: 'File Too Large', message: 'Maximum upload size is 10MB' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      await api.post(`/clients/${id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify({
        type: 'success',
        title: 'File Uploaded',
        message: `Successfully uploaded ${file.name}`,
      });
      loadClientDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Upload Failed', message: errorMessage(err) });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/clients/files/${fileId}`);
      notify({ type: 'success', title: 'Document Deleted' });
      loadClientDetails();
    } catch (err) {
      notify({ type: 'error', title: 'Delete Failed', message: errorMessage(err) });
    }
  };

  return (
    <div className="grid gap-6">
      {/* Header with back button & controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/clients')} className="p-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {client.companyName}
              {client.status === 'ARCHIVED' && (
                <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-600">
                  Archived
                </span>
              )}
            </h1>
            <p className="text-xs text-foreground/50">
              {client.industry} • ID: {client.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {client.projects && client.projects.length > 0 && (
            <Button
              onClick={() => {
                const firstProj = client.projects?.[0];
                if (firstProj) {
                  localStorage.setItem('client-portal-project-id', firstProj.id);
                  navigate('/portal');
                }
              }}
              variant="ghost"
              className="flex items-center gap-2 border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs h-10 px-4 rounded-xl shadow-sm"
            >
              <Shield className="h-4 w-4" /> Client Portal View
            </Button>
          )}

          {isAdmin && (
            <>
              <Button
                variant="ghost"
                onClick={handleArchiveRestoreClient}
                className="flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-bold"
              >
                {client.status === 'ARCHIVED' ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                {client.status === 'ARCHIVED' ? 'Restore Client' : 'Archive Client'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const primaryContact = client.contacts?.find((contact) => contact.primaryContact);
                  const [firstName = '', ...lastNameParts] = (primaryContact?.name ?? '').split(
                    ' ',
                  );
                  setPortalLoginForm({
                    email: primaryContact?.email || client.email || '',
                    password: '',
                    firstName,
                    lastName: lastNameParts.join(' '),
                  });
                  setShowPortalLoginForm(true);
                }}
                className="flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-bold"
              >
                <Shield className="h-4 w-4" /> Portal Login
              </Button>
              <Button
                onClick={() => setIsEditingClient(!isEditingClient)}
                className="flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-bold"
              >
                <Settings className="h-4 w-4" /> Edit Info
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-border overflow-x-auto text-sm font-semibold">
        {(
          [
            { id: 'overview', label: 'Overview', icon: Building, visible: true },
            { id: 'contacts', label: 'Contacts', icon: Users, visible: true },
            { id: 'projects', label: 'Projects', icon: FolderKanban, visible: true },
            { id: 'quotes', label: 'Quotations', icon: FileText, visible: canSeeBilling },
            { id: 'invoices', label: 'Billing', icon: FileText, visible: canSeeBilling },
            { id: 'files', label: 'Files', icon: Upload, visible: true },
            { id: 'notes', label: 'Notes', icon: MessageSquare, visible: true },
            { id: 'activity', label: 'Activity', icon: Clock, visible: true },
            { id: 'timelogs', label: 'Time Logs', icon: Clock, visible: true },
          ] as const
        )
          .filter((tab) => tab.visible)
          .map((tab) => (
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

      {/* Detail Layout */}
      <div className="grid gap-6">
        {/* --- CLIENT PORTAL LOGIN PANEL --- */}
        {showPortalLoginForm && (
          <Card className="border border-primary/20 bg-primary/5">
            <h2 className="text-base font-bold mb-4">Create Client Portal Login</h2>
            <form onSubmit={handleCreatePortalLogin} className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Email Address"
                type="email"
                value={portalLoginForm.email}
                onChange={(e) => setPortalLoginForm({ ...portalLoginForm, email: e.target.value })}
                required
              />
              <Input
                label="Initial Password"
                type="password"
                value={portalLoginForm.password}
                onChange={(e) =>
                  setPortalLoginForm({ ...portalLoginForm, password: e.target.value })
                }
                minLength={6}
                required
              />
              <Input
                label="First Name"
                value={portalLoginForm.firstName}
                onChange={(e) =>
                  setPortalLoginForm({ ...portalLoginForm, firstName: e.target.value })
                }
                required
              />
              <Input
                label="Last Name"
                value={portalLoginForm.lastName}
                onChange={(e) =>
                  setPortalLoginForm({ ...portalLoginForm, lastName: e.target.value })
                }
                required
              />
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowPortalLoginForm(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Login</Button>
              </div>
            </form>
          </Card>
        )}
        {/* --- EDIT CLIENT PANEL --- */}
        {isEditingClient && (
          <Card className="border border-primary/20 bg-primary/5">
            <h2 className="text-base font-bold mb-4">Edit Company Information</h2>
            <form onSubmit={handleUpdateClient} className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Company Name"
                value={editClientForm.companyName || ''}
                onChange={(e) =>
                  setEditClientForm({ ...editClientForm, companyName: e.target.value })
                }
              />
              <Input
                label="Company Logo URL"
                value={editClientForm.companyLogo || ''}
                onChange={(e) =>
                  setEditClientForm({ ...editClientForm, companyLogo: e.target.value })
                }
              />
              <Input
                label="Industry"
                value={editClientForm.industry || ''}
                onChange={(e) => setEditClientForm({ ...editClientForm, industry: e.target.value })}
              />
              <Input
                label="Website"
                value={editClientForm.website || ''}
                onChange={(e) => setEditClientForm({ ...editClientForm, website: e.target.value })}
              />
              <Input
                label="Company Email"
                value={editClientForm.email || ''}
                onChange={(e) => setEditClientForm({ ...editClientForm, email: e.target.value })}
              />
              <Input
                label="Company Phone"
                value={editClientForm.phone || ''}
                onChange={(e) => setEditClientForm({ ...editClientForm, phone: e.target.value })}
              />
              {isAdmin && (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Account Manager</label>
                  <select
                    value={editClientForm.assignedManagerId || ''}
                    onChange={(e) =>
                      setEditClientForm({ ...editClientForm, assignedManagerId: e.target.value })
                    }
                    className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none"
                  >
                    <option value="">Unassigned</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium">Billing Address</label>
                <textarea
                  value={editClientForm.billingAddress || ''}
                  onChange={(e) =>
                    setEditClientForm({ ...editClientForm, billingAddress: e.target.value })
                  }
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                  rows={2}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium">Shipping Address</label>
                <textarea
                  value={editClientForm.shippingAddress || ''}
                  onChange={(e) =>
                    setEditClientForm({ ...editClientForm, shippingAddress: e.target.value })
                  }
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setIsEditingClient(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Card>
        )}

        {/* --- TAB CONTENT: OVERVIEW --- */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Stats Block */}
            {canSeeBilling && (
              <Card className="flex flex-col gap-4 justify-between bg-primary/5 border border-primary/10">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                    Financial Stats
                  </span>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-2xl font-bold text-foreground">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: client.currency || 'USD',
                        }).format(revenueGenerated)}
                      </span>
                      <span className="text-xs text-foreground/50">Revenue Generated</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-600">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-2xl font-bold text-foreground">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: client.currency || 'USD',
                        }).format(outstandingBalance)}
                      </span>
                      <span className="text-xs text-foreground/50">Outstanding Balance</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <Card className="flex flex-col gap-4 justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                  Project Stats
                </span>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-2xl font-bold text-foreground">
                      {activeProjectCount}
                    </span>
                    <span className="text-xs text-foreground/50">Active Projects</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-2xl font-bold text-foreground">
                      {clientProjects.length}
                    </span>
                    <span className="text-xs text-foreground/50">Total Projects</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="flex flex-col gap-4 justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                  Account Manager
                </span>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground/70">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block font-bold text-foreground">
                      {client.assignedManager
                        ? `${client.assignedManager.firstName} ${client.assignedManager.lastName}`
                        : 'Unassigned'}
                    </span>
                    <span className="text-xs text-foreground/50">
                      {client.assignedManager
                        ? client.assignedManager.email
                        : 'Account manager not assigned'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* General Info Card */}
            <Card className="md:col-span-2 grid gap-4">
              <h3 className="text-base font-bold">Company Profile</h3>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <span className="block text-xs font-semibold text-foreground/50">Website</span>
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" /> {client.website}
                  </a>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-foreground/50">Email</span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-foreground/40" /> {client.email}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-foreground/50">Phone</span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-foreground/40" /> {client.phone}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-foreground/50">Industry</span>
                  <span>{client.industry}</span>
                </div>
                {client.taxNumber && (
                  <div>
                    <span className="block text-xs font-semibold text-foreground/50">
                      Tax ID / VAT
                    </span>
                    <span>{client.taxNumber}</span>
                  </div>
                )}
                <div>
                  <span className="block text-xs font-semibold text-foreground/50">
                    Currency / Timezone
                  </span>
                  <span>
                    {client.currency} / {client.timezone}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="grid gap-4">
              <h3 className="text-base font-bold">Addresses</h3>
              <div className="grid gap-4 text-sm">
                <div>
                  <span className="block text-xs font-semibold text-foreground/50">
                    Billing Address
                  </span>
                  <p className="mt-1 leading-relaxed text-foreground/80">{client.billingAddress}</p>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-foreground/50">
                    Shipping Address
                  </span>
                  <p className="mt-1 leading-relaxed text-foreground/80">
                    {client.shippingAddress}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-foreground/50">Location</span>
                  <span>
                    {client.city}, {client.state}, {client.postalCode}, {client.country}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* --- TAB CONTENT: CONTACTS --- */}
        {activeTab === 'contacts' && (
          <div className="grid gap-6">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold">Contacts list</h3>
              {isAdmin && (
                <Button
                  onClick={() => setShowContactForm(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Add Contact
                </Button>
              )}
            </div>

            {showContactForm && (
              <Card className="border border-primary/20 bg-primary/5">
                <h4 className="text-sm font-bold mb-4">
                  {editingContact ? 'Edit Contact Details' : 'Add New Contact'}
                </h4>
                <form onSubmit={handleContactSubmit} className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Full Name *"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    required
                  />
                  <Input
                    label="Job Position *"
                    value={contactForm.position}
                    onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })}
                    required
                  />
                  <Input
                    label="Email Address *"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    required
                  />
                  <Input
                    label="Phone Number *"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    required
                  />
                  <Input
                    label="WhatsApp Link/Number"
                    value={contactForm.whatsapp}
                    onChange={(e) => setContactForm({ ...contactForm, whatsapp: e.target.value })}
                    placeholder="e.g. +15550192"
                  />
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <input
                      type="checkbox"
                      id="primaryContact"
                      checked={contactForm.primaryContact}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, primaryContact: e.target.checked })
                      }
                    />
                    <label htmlFor="primaryContact" className="text-sm font-medium">
                      Set as Primary Contact
                    </label>
                  </div>
                  <div className="flex gap-2 justify-end sm:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowContactForm(false);
                        setEditingContact(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save Contact</Button>
                  </div>
                </form>
              </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {client.contacts?.length === 0 ? (
                <div className="text-center py-6 text-foreground/50 sm:col-span-3">
                  No contacts listed.
                </div>
              ) : (
                client.contacts?.map((contact) => (
                  <Card key={contact.id} className="relative flex flex-col gap-3">
                    {contact.primaryContact && (
                      <span className="absolute top-4 right-4 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                        Primary
                      </span>
                    )}
                    <div>
                      <span className="block font-bold text-foreground">{contact.name}</span>
                      <span className="text-xs text-foreground/50">{contact.position}</span>
                    </div>
                    <div className="grid gap-1.5 text-xs text-foreground/75 border-t border-border pt-3 mt-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-foreground/40" />
                        <span>{contact.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-foreground/40" />
                        <span>{contact.phone}</span>
                      </div>
                      {contact.whatsapp && (
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                          <span>WhatsApp: {contact.whatsapp}</span>
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex justify-end gap-2 border-t border-border pt-3 mt-2">
                        <Button
                          variant="ghost"
                          onClick={() => startEditContact(contact)}
                          className="h-8 px-2.5 text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteContact(contact.id)}
                          className="h-8 px-2.5 text-xs text-danger hover:bg-danger/10"
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- TAB CONTENT: PROJECTS --- */}
        {activeTab === 'projects' && (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 font-semibold text-foreground/80">
                    <th className="px-6 py-4">Project Name</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Progress</th>
                    <th className="px-6 py-4">Budget</th>
                    <th className="px-6 py-4">Approved Hours</th>
                    <th className="px-6 py-4">Billable Value</th>
                    <th className="px-6 py-4">Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clientProjects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-foreground/45">
                        No projects active for this client yet.
                      </td>
                    </tr>
                  ) : (
                    clientProjects.map((project) => (
                      <tr
                        key={project.id}
                        className="cursor-pointer transition hover:bg-muted/30"
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        <td className="px-6 py-4">
                          <span className="block font-semibold text-foreground">
                            {project.projectName}
                          </span>
                          <span className="text-xs text-foreground/50">{project.projectCode}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold">
                            {project.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex min-w-36 items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${project.progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold">{project.progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold">
                          ${Number(project.budget).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-semibold text-primary">
                          {approvedHoursForProject(project).toFixed(2)} hrs
                        </td>
                        <td className="px-6 py-4 font-semibold text-emerald-600">
                          ${approvedValueForProject(project).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-foreground/70">
                          {new Date(project.deadline).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* --- TAB CONTENT: BILLING --- */}
        {activeTab === 'invoices' && (
          <div className="grid gap-6">
            {/* Aggregate Metric Cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="p-5 border border-border rounded-2xl bg-card">
                <span className="text-[10px] uppercase font-bold text-foreground/45 block">
                  Total Invoiced
                </span>
                <span className="text-xl font-bold mt-2 block text-primary">
                  ${(client.invoices?.reduce((sum, i) => sum + i.total, 0) || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-5 border border-border rounded-2xl bg-card">
                <span className="text-[10px] uppercase font-bold text-foreground/45 block">
                  Total Paid
                </span>
                <span className="text-xl font-bold mt-2 block text-emerald-600">
                  $
                  {(
                    client.invoices?.reduce((sum, i) => sum + i.amountPaid, 0) || 0
                  ).toLocaleString()}
                </span>
              </div>
              <div className="p-5 border border-border rounded-2xl bg-card">
                <span className="text-[10px] uppercase font-bold text-foreground/45 block">
                  Outstanding Balance
                </span>
                <span className="text-xl font-bold mt-2 block text-danger">
                  $
                  {(
                    client.invoices?.reduce((sum, i) => sum + i.balanceDue, 0) || 0
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Quotations List */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3">Quotations & Contracts</h3>
              <Card className="p-0 overflow-hidden border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 font-semibold text-foreground/80">
                        <th className="px-6 py-4">Quote Number</th>
                        <th className="px-6 py-4">Title</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Valid Until</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.quotations?.length ? (
                        client.quotations.map((quote) => (
                          <tr
                            key={quote.id}
                            className="border-b border-border hover:bg-muted/5 transition"
                          >
                            <td className="px-6 py-4 font-bold">{quote.quoteNumber}</td>
                            <td className="px-6 py-4 text-foreground/80">{quote.title}</td>
                            <td className="px-6 py-4 font-bold">${quote.total.toLocaleString()}</td>
                            <td className="px-6 py-4 text-foreground/60">
                              {new Date(quote.validUntil).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  quote.status === 'ACCEPTED'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : 'bg-amber-500/10 text-amber-600'
                                }`}
                              >
                                {quote.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-foreground/45 italic"
                          >
                            No quotations logged for this client.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Invoices List */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3">Invoices History</h3>
              <Card className="p-0 overflow-hidden border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 font-semibold text-foreground/80">
                        <th className="px-6 py-4">Invoice Number</th>
                        <th className="px-6 py-4">Project</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Balance</th>
                        <th className="px-6 py-4">Due Date</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.invoices?.length ? (
                        client.invoices.map((invoice) => (
                          <tr
                            key={invoice.id}
                            className="border-b border-border hover:bg-muted/5 transition"
                          >
                            <td className="px-6 py-4 font-bold">{invoice.invoiceNumber}</td>
                            <td className="px-6 py-4">
                              {invoice.project?.projectName ?? 'No project'}
                            </td>
                            <td className="px-6 py-4">
                              {invoice.currency} {invoice.total.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              {invoice.currency} {invoice.balanceDue.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              {new Date(invoice.dueDate).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  invoice.status === 'PAID'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : 'bg-amber-500/10 text-amber-600'
                                }`}
                              >
                                {invoice.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-6 py-12 text-center text-foreground/45 italic"
                          >
                            No invoices found for this client.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Payments List */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3">Recorded Payments History</h3>
              <Card className="p-0 overflow-hidden border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 font-semibold text-foreground/80">
                        <th className="px-6 py-4">Invoice Reference</th>
                        <th className="px-6 py-4">Method</th>
                        <th className="px-6 py-4">Reference ID</th>
                        <th className="px-6 py-4">Amount Paid</th>
                        <th className="px-6 py-4">Payment Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.invoices?.some((i) => i.payments?.length) ? (
                        client.invoices
                          .flatMap((i) =>
                            (i.payments || []).map((p) => ({
                              ...p,
                              invoiceNumber: i.invoiceNumber,
                              currency: i.currency,
                            })),
                          )
                          .map((p: any) => (
                            <tr
                              key={p.id}
                              className="border-b border-border hover:bg-muted/5 transition"
                            >
                              <td className="px-6 py-4 font-bold">{p.invoiceNumber}</td>
                              <td className="px-6 py-4 font-medium">{p.paymentMethod}</td>
                              <td className="px-6 py-4 font-mono text-foreground/60">
                                {p.referenceNumber || 'N/A'}
                              </td>
                              <td className="px-6 py-4 font-bold text-emerald-600">
                                ${p.amount.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-foreground/60">
                                {new Date(p.paymentDate).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-foreground/45 italic"
                          >
                            No payments logged for this client.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* --- TAB CONTENT: QUOTATIONS --- */}
        {activeTab === 'quotes' && (
          <div className="grid gap-6 animate-fade-in">
            {/* Summary cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-5 border border-border bg-card">
                <span className="text-[10px] uppercase font-bold text-foreground/45 block">
                  Total Quotations Value
                </span>
                <span className="text-xl font-bold mt-2 block text-primary">
                  {client?.currency || 'USD'}{' '}
                  {(client?.quotations?.reduce((sum, q) => sum + q.total, 0) || 0).toLocaleString()}
                </span>
              </Card>
              <Card className="p-5 border border-border bg-card">
                <span className="text-[10px] uppercase font-bold text-foreground/45 block">
                  Accepted Quotations
                </span>
                <span className="text-xl font-bold mt-2 block text-emerald-600">
                  {client?.quotations?.filter((q) => q.status === 'ACCEPTED').length || 0} /{' '}
                  {client?.quotations?.length || 0}
                </span>
              </Card>
            </div>

            {/* Quotations List table */}
            <Card className="p-0 overflow-hidden border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 font-semibold text-foreground/80">
                      <th className="px-6 py-4">Quote Number</th>
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Valid Until</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {client?.quotations?.length ? (
                      client.quotations.map((q) => (
                        <tr key={q.id} className="hover:bg-muted/5 transition font-normal">
                          <td className="px-6 py-4 font-bold">{q.quoteNumber}</td>
                          <td className="px-6 py-4">
                            <div>{q.title}</div>
                            {q.project && (
                              <span className="text-xs text-foreground/50">
                                Project: {q.project.projectName}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-semibold">
                            {client.currency || 'USD'} {q.total.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            {new Date(q.validUntil).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                q.status === 'ACCEPTED'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-amber-500/10 text-amber-600'
                              }`}
                            >
                              {q.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <a
                              href={`${api.defaults.baseURL}/quotations/${q.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline font-bold text-xs inline-flex items-center gap-1"
                            >
                              <Download className="h-3 w-3" /> Download
                            </a>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center text-foreground/45 italic"
                        >
                          No quotations created for this client.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* --- TAB CONTENT: FILES --- */}
        {activeTab === 'files' && (
          <div className="grid gap-6">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-foreground">Documents</h3>
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.zip"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload File'}
                </Button>
              </div>
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 font-semibold text-foreground/80">
                      <th className="px-6 py-4">File Name</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Size</th>
                      <th className="px-6 py-4">Uploaded</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {client.files?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-foreground/50">
                          No documents uploaded. Supported: PDF, Images, Word, Excel, ZIP.
                        </td>
                      </tr>
                    ) : (
                      client.files?.map((file) => (
                        <tr key={file.id} className="hover:bg-muted/30 transition">
                          <td className="px-6 py-4 font-semibold">{file.name}</td>
                          <td className="px-6 py-4 uppercase text-xs font-semibold text-foreground/60">
                            {file.type.split('/')[1] || file.type}
                          </td>
                          <td className="px-6 py-4 text-xs">{Math.round(file.size / 1024)} KB</td>
                          <td className="px-6 py-4 text-xs text-foreground/60">
                            {new Date(file.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right flex justify-end gap-2">
                            <a
                              href={`${api.defaults.baseURL || ''}${file.url}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Button
                                variant="ghost"
                                className="flex items-center gap-1 h-8 px-2.5 text-xs"
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                            </a>
                            <Button
                              variant="ghost"
                              onClick={() => handleDeleteFile(file.id)}
                              className="h-8 px-2.5 text-xs text-danger hover:bg-danger/10 border-none bg-transparent"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* --- TAB CONTENT: NOTES --- */}
        {activeTab === 'notes' && (
          <div className="grid gap-6">
            <h3 className="text-base font-bold text-foreground">Internal Notes</h3>

            <Card className="flex flex-col gap-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/65">
                {editingNoteId ? 'Edit Internal Note' : 'Add Internal Note'}
              </h4>
              <form onSubmit={handleNoteSubmit} className="flex flex-col gap-3">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Type internal note here... (Visible only to Admins and Staff members)"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  rows={3}
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
              {client.notes?.length === 0 ? (
                <div className="text-center py-6 text-foreground/50">No notes written yet.</div>
              ) : (
                client.notes?.map((note) => (
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

        {/* --- TAB CONTENT: TIMELOGS (TIMESHEETS) --- */}
        {activeTab === 'timelogs' && (
          <div className="grid gap-6 animate-fade-in">
            {/* Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card className="p-4 flex flex-col justify-between border border-border shadow-xs bg-card">
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
                  Total Hours
                </span>
                <span className="block text-2xl font-black text-foreground mt-2">
                  {Math.round(
                    clientProjects
                      .flatMap((p) => p.timeLogs ?? [])
                      .reduce((sum, log) => sum + Number(log.duration || 0), 0) * 100,
                  ) / 100}{' '}
                  hrs
                </span>
              </Card>
              <Card className="p-4 flex flex-col justify-between border border-border shadow-xs bg-card">
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
                  Billable Hours
                </span>
                <span className="block text-2xl font-black text-emerald-600 mt-2">
                  {Math.round(
                    clientProjects
                      .flatMap((p) => p.timeLogs ?? [])
                      .filter((l) => l.billable)
                      .reduce((sum, log) => sum + Number(log.duration || 0), 0) * 100,
                  ) / 100}{' '}
                  hrs
                </span>
              </Card>
              <Card className="p-4 flex flex-col justify-between border border-border shadow-xs bg-card">
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
                  Non-Billable Hours
                </span>
                <span className="block text-2xl font-black text-foreground mt-2">
                  {Math.round(
                    (clientProjects
                      .flatMap((p) => p.timeLogs ?? [])
                      .reduce((sum, log) => sum + Number(log.duration || 0), 0) -
                      clientProjects
                        .flatMap((p) => p.timeLogs ?? [])
                        .filter((l) => l.billable)
                        .reduce((sum, log) => sum + Number(log.duration || 0), 0)) *
                      100,
                  ) / 100}{' '}
                  hrs
                </span>
              </Card>
              <Card className="p-4 flex flex-col justify-between border border-border shadow-xs bg-card">
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
                  Estimated Hours
                </span>
                <span className="block text-2xl font-black text-foreground mt-2">
                  {clientProjects.reduce((sum, p) => sum + Number(p.estimatedHours || 0), 0)} hrs
                </span>
              </Card>
              <Card className="p-4 flex flex-col justify-between border border-border shadow-xs bg-card">
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
                  Revenue Generated
                </span>
                <span className="block text-2xl font-black text-foreground mt-2">
                  $
                  {Math.round(
                    clientProjects
                      .flatMap((p) => p.timeLogs ?? [])
                      .filter((l) => l.billable)
                      .reduce(
                        (sum, log) =>
                          sum +
                          Number(log.duration || 0) *
                            Number(log.hourlyRateSnapshot || log.user?.hourlyRate || 0),
                        0,
                      ) * 100,
                  ) / 100}
                </span>
              </Card>
            </div>

            {/* Staff Breakdown */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-5 flex flex-col gap-4 border border-border bg-card">
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <Users className="h-4.5 w-4.5 text-primary" /> Staff Breakdown
                </h3>
                <div className="space-y-4 text-xs font-semibold">
                  {(() => {
                    const devMap: Record<string, number> = {};
                    clientProjects
                      .flatMap((p) => p.timeLogs ?? [])
                      .forEach((log) => {
                        const name = log.user
                          ? `${log.user.firstName} ${log.user.lastName}`
                          : 'Unassigned';
                        devMap[name] = (devMap[name] || 0) + Number(log.duration || 0);
                      });
                    const devList = Object.entries(devMap).sort((a, b) => b[1] - a[1]);
                    const maxVal = Math.max(...devList.map((e) => e[1]), 1);

                    return devList.map(([name, hours]) => {
                      const pct = Math.round((hours / maxVal) * 100);
                      return (
                        <div key={name}>
                          <div className="flex justify-between mb-1">
                            <span>{name}</span>
                            <span className="text-primary font-bold">{hours.toFixed(2)} hrs</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                  {clientProjects.flatMap((p) => p.timeLogs ?? []).length === 0 && (
                    <div className="text-center py-6 text-foreground/55 italic">
                      No logs recorded.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-5 flex flex-col gap-4 border border-border bg-card">
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <FolderKanban className="h-4.5 w-4.5 text-primary" /> Project Breakdown
                </h3>
                <div className="space-y-4 text-xs font-semibold">
                  {clientProjects.map((p) => {
                    const hours = (p.timeLogs ?? []).reduce(
                      (sum, log) => sum + Number(log.duration || 0),
                      0,
                    );
                    const maxHours = Math.max(
                      ...clientProjects.map((pr) =>
                        (pr.timeLogs ?? []).reduce((s, l) => s + Number(l.duration || 0), 0),
                      ),
                      1,
                    );
                    const pct = Math.round((hours / maxHours) * 100);
                    return (
                      <div key={p.id}>
                        <div className="flex justify-between mb-1">
                          <span>{p.projectName}</span>
                          <span className="text-primary font-bold">{hours.toFixed(2)} hrs</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {clientProjects.length === 0 && (
                    <div className="text-center py-6 text-foreground/55 italic">
                      No projects linked to client.
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Recent Time Logs */}
            <Card className="p-0 overflow-hidden text-xs border border-border bg-card">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-bold text-sm">Recent Time Logs</h3>
              </div>
              <div className="overflow-x-auto font-semibold">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border font-bold text-foreground/75 uppercase tracking-wider text-[10px]">
                      <th className="px-5 py-3">Member</th>
                      <th className="px-5 py-3">Project</th>
                      <th className="px-5 py-3">Description</th>
                      <th className="px-5 py-3">Hours</th>
                      <th className="px-5 py-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {clientProjects
                      .flatMap((p) =>
                        (p.timeLogs ?? []).map((l) => ({ ...l, projectName: p.projectName })),
                      )
                      .sort(
                        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
                      )
                      .slice(0, 10)
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-muted/10 transition">
                          <td className="px-5 py-3.5 font-bold">
                            {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'N/A'}
                          </td>
                          <td className="px-5 py-3.5 font-bold">{log.projectName}</td>
                          <td className="px-5 py-3.5 text-foreground/80">{log.description}</td>
                          <td className="px-5 py-3.5 font-bold text-primary">{log.duration} hrs</td>
                          <td className="px-5 py-3.5 text-right text-foreground/50">
                            {new Date(log.startTime).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    {clientProjects.flatMap((p) => p.timeLogs ?? []).length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-10 text-center text-foreground/45 italic"
                        >
                          No time logs recorded for this client.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* --- TAB CONTENT: ACTIVITY --- */}
        {activeTab === 'activity' && (
          <div className="grid gap-6">
            <h3 className="text-base font-bold text-foreground">Activity Timeline</h3>
            <div className="relative border-l border-border pl-6 ml-3 flex flex-col gap-6">
              {client.activities?.length === 0 ? (
                <div className="text-sm text-foreground/50 pl-2">No activity recorded.</div>
              ) : (
                client.activities?.map((act) => (
                  <div key={act.id} className="relative text-sm">
                    {/* Circle icon marker on line */}
                    <div className="absolute -left-[31px] top-1 bg-background border-2 border-primary h-4 w-4 rounded-full flex items-center justify-center" />
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
