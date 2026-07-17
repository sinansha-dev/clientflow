import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  FileText,
  List,
  Layers,
  ScrollText,
  Paperclip,
  Lock,
  Save,
  Send,
  Eye,
  X,
  GripVertical,
  AlertCircle,
  CheckCircle,
  CreditCard,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useToastStore } from '../../stores/toast-store';
import { errorMessage } from '../../lib/errors';
import type { Client, Project, Invoice, InvoiceAttachment } from '@clientflow/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  _key: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);
const today = new Date().toISOString().slice(0, 10);
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

const money = (value = 0, currency = 'USD') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(
    value,
  );

function itemTotal(item: LineItem) {
  const base = item.quantity * item.unitPrice;
  const afterDiscount = base - item.discount;
  return afterDiscount + afterDiscount * (item.taxRate / 100);
}

function calcTotals(items: LineItem[], globalDiscount: number) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tax = items.reduce(
    (s, i) =>
      s +
      i.quantity *
        i.unitPrice *
        (1 - i.discount / (i.quantity * i.unitPrice || 1)) *
        (i.taxRate / 100),
    0,
  );
  const itemDiscounts = items.reduce((s, i) => s + i.discount, 0);
  const total = Math.max(subtotal + tax - itemDiscounts - globalDiscount, 0);
  return { subtotal, tax, itemDiscounts, total };
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">{title}</p>
            {subtitle && <p className="text-xs text-foreground/50 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-foreground/40" />
        ) : (
          <ChevronDown className="h-4 w-4 text-foreground/40" />
        )}
      </button>
      {open && <div className="border-t border-border px-6 py-5">{children}</div>}
    </Card>
  );
}

// ─── Field / Select helpers ────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  className = '',
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 text-xs font-bold text-foreground/60 ${className}`}>
      {label}
      {required && <span className="inline text-danger"> *</span>}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 text-xs font-bold text-foreground/60 ${className}`}>
      {label}
      {required && <span className="inline text-danger"> *</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <option value="">Select</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-foreground/60 w-full">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary resize-y leading-relaxed"
      />
    </label>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function InvoiceEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const notify = useToastStore((s) => s.notify);

  const isEditing = Boolean(id);

  // ── Data loading ──
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Section 1: Basic Invoice Info ──
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('Auto-generated');
  const [title, setTitle] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(nextMonth);
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState('DRAFT');
  const [notes, setNotes] = useState('');

  // ── Section 2: Billing Plan Context ──
  const [billingStageId, setBillingStageId] = useState<string | null>(null);
  const [billingPlanContext, setBillingPlanContext] = useState<any>(null);

  // ── Section 3: Invoice Items ──
  const [items, setItems] = useState<LineItem[]>([
    { _key: uid(), name: '', description: '', quantity: 1, unitPrice: 0, taxRate: 18, discount: 0 },
  ]);
  const [globalDiscount, setGlobalDiscount] = useState(0);

  // ── Section 4: Scope ──
  const [scope, setScope] = useState('');

  // ── Section 5: Payment Info ──
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentInstructions, setPaymentInstructions] = useState(
    'Bank Name: Axis Bank\nAccount No: 925010019028212\nIFSC Code: UTIB0003426\nAccount Holder: Mohammed Sinan Sha T\nUPI ID: 7025787496@axisbank',
  );

  // ── Section 6: Terms ──
  const [termsConditions, setTermsConditions] = useState(
    'Payment Terms: Invoices are due within 30 days. Late fee of 1.5% per month applies.',
  );

  // ── Section 7: Attachments ──
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);

  // ── Section 8: Internal Notes ──
  const [internalNotes, setInternalNotes] = useState('');

  // ── Financial summaries ──
  const [amountPaid, setAmountPaid] = useState(0);

  // ── Computed ──
  const totals = useMemo(() => calcTotals(items, globalDiscount), [items, globalDiscount]);
  const balanceDue = useMemo(
    () => Math.max(totals.total - amountPaid, 0),
    [totals.total, amountPaid],
  );

  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  const projectOptions = useMemo(
    () => projects.filter((p) => !clientId || p.clientId === clientId),
    [projects, clientId],
  );

  // ── Load data ──
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [clientRes, projectRes] = await Promise.all([
          api.get('/clients?limit=1000'),
          api.get('/projects?limit=1000'),
        ]);
        setClients(clientRes.data.data?.items ?? []);
        setProjects(projectRes.data.data?.items ?? []);

        if (id) {
          const iRes = await api.get('/invoices');
          const inv: Invoice = (iRes.data.data as Invoice[]).find((x) => x.id === id)!;
          if (!inv) throw new Error('Invoice not found');
          setClientId(inv.clientId);
          setProjectId(inv.projectId ?? '');
          setInvoiceNumber(inv.invoiceNumber);
          setTitle(inv.title || 'Invoice');
          setIssueDate(String(inv.issueDate).slice(0, 10));
          setDueDate(String(inv.dueDate).slice(0, 10));
          setCurrency(inv.currency ?? 'USD');
          setStatus(inv.status);
          setNotes(inv.notes ?? '');
          setScope(inv.scope ?? '');
          setTermsConditions(inv.termsConditions ?? '');
          setInternalNotes(inv.internalNotes ?? '');
          setGlobalDiscount(inv.discount ?? 0);
          setAmountPaid(inv.amountPaid ?? 0);
          setPaymentMethod(inv.paymentMethod ?? 'Bank Transfer');
          setPaymentInstructions(inv.paymentInstructions ?? '');
          setBillingStageId(inv.billingStageId ?? null);
          setAttachments((inv.attachments as InvoiceAttachment[]) ?? []);

          if (inv.billingStage) {
            setBillingPlanContext({
              stageName: inv.billingStage.name,
              amount: inv.billingStage.amount,
              planType: inv.billingStage.billingPlan?.billingType,
              totalAmount: inv.billingStage.billingPlan?.totalAmount,
            });
          }

          if (inv.items && inv.items.length > 0) {
            setItems(
              inv.items.map((i) => ({
                _key: uid(),
                name: i.name,
                description: i.description ?? '',
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                taxRate: i.taxRate,
                discount: 0,
              })),
            );
          }
        }
      } catch (err) {
        notify({ type: 'error', title: 'Load failed', message: errorMessage(err) });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  // Auto-set currency from client
  useEffect(() => {
    if (selectedClient?.currency) setCurrency(selectedClient.currency);
  }, [selectedClient]);

  // ── Item helpers ──
  const addItem = () =>
    setItems((prev) => [
      ...prev,
      {
        _key: uid(),
        name: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 18,
        discount: 0,
      },
    ]);

  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i._key !== key));

  const duplicateItem = (key: string) =>
    setItems((prev) => {
      const idx = prev.findIndex((i) => i._key === key);
      if (idx < 0) return prev;
      const original = prev[idx]!;
      const copy: LineItem = { ...original, _key: uid() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });

  const updateItem = useCallback(
    (key: string, field: keyof LineItem, value: string | number) =>
      setItems((prev) => prev.map((i) => (i._key === key ? { ...i, [field]: value } : i))),
    [],
  );

  // ── Attachment helpers ──
  const addAttachment = () =>
    setAttachments((prev) => [...prev, { name: '', url: '', type: 'PDF' }]);
  const removeAttachment = (i: number) =>
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  const updateAttachment = (i: number, field: keyof InvoiceAttachment, value: string) =>
    setAttachments((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));

  // ── Save ──
  const save = async (nextStatus?: string) => {
    if (!clientId) {
      notify({ type: 'error', title: 'Validation', message: 'Please select a client.' });
      return;
    }
    if (!title.trim()) {
      notify({ type: 'error', title: 'Validation', message: 'Invoice Title is required.' });
      return;
    }
    if (items.some((i) => !i.name.trim())) {
      notify({ type: 'error', title: 'Validation', message: 'All items must have a name.' });
      return;
    }
    if (totals.total <= 0) {
      notify({
        type: 'error',
        title: 'Validation',
        message: 'Invoice total must be greater than zero.',
      });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        clientId,
        projectId: projectId || undefined,
        title,
        issueDate,
        dueDate,
        currency,
        status: nextStatus ?? status,
        notes: notes || undefined,
        scope: scope || undefined,
        termsConditions: termsConditions || undefined,
        internalNotes: internalNotes || undefined,
        discount: globalDiscount,
        paymentMethod: paymentMethod || undefined,
        paymentInstructions: paymentInstructions || undefined,
        attachments: attachments.filter((a) => a.name && a.url),
        items: items.map((i) => ({
          name: i.name,
          description: i.description || undefined,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
        })),
        billingStageId: billingStageId || undefined,
      };

      if (isEditing) {
        await api.patch(`/invoices/${id}`, payload);
        notify({ type: 'success', title: 'Invoice updated' });
      } else {
        await api.post('/invoices', payload);
        notify({ type: 'success', title: 'Invoice created' });
      }
      navigate('/invoices?tab=invoices');
    } catch (err) {
      notify({ type: 'error', title: 'Save failed', message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-foreground/55">Finance / Invoices</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {isEditing ? `Edit Invoice — ${invoiceNumber}` : 'New Invoice'}
          </h1>
          <p className="mt-1 text-sm text-foreground/55">
            Create or update client billing requests with full project summary integration.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/invoices?tab=invoices')}
          className="flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground transition"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* ── Left: Form Sections ── */}
        <div className="grid gap-4">
          {/* ── Section 1: Basic Info ── */}
          <Section
            icon={FileText}
            title="Invoice Information"
            subtitle="Client, dates, title and default billing currency"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Client"
                value={clientId}
                onChange={(v) => {
                  setClientId(v);
                  setProjectId('');
                }}
                options={clients.map((c) => [c.id, c.companyName] as [string, string])}
                required
              />
              <SelectField
                label="Project"
                value={projectId}
                onChange={setProjectId}
                options={[
                  ['', 'No project (Internal)'] as [string, string],
                  ...projectOptions.map((p) => [p.id, p.projectName] as [string, string]),
                ]}
              />
              <Field
                label="Invoice Number"
                value={invoiceNumber}
                onChange={() => {}}
                className="opacity-60"
              />
              <Field
                label="Invoice Title"
                value={title}
                onChange={setTitle}
                required
                placeholder="e.g. Website Development - Milestone 1"
              />
              <Field label="Issue Date" type="date" value={issueDate} onChange={setIssueDate} />
              <Field label="Due Date" type="date" value={dueDate} onChange={setDueDate} required />
              <SelectField
                label="Currency"
                value={currency}
                onChange={setCurrency}
                options={[
                  ['USD', 'USD — US Dollar'],
                  ['INR', 'INR — Indian Rupee'],
                  ['EUR', 'EUR — Euro'],
                  ['GBP', 'GBP — British Pound'],
                  ['AED', 'AED — UAE Dirham'],
                ]}
              />
              <SelectField
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  ['DRAFT', 'Draft'],
                  ['SENT', 'Sent'],
                  ['PAID', 'Paid'],
                  ['PARTIALLY_PAID', 'Partially Paid'],
                  ['OVERDUE', 'Overdue'],
                ]}
              />
            </div>
          </Section>

          {/* ── Section 2: Billing Plan Context (If applicable) ── */}
          {billingPlanContext && (
            <Section
              icon={Layers}
              title="Billing Plan Integration"
              subtitle="Milestone details originating this invoice"
            >
              <div className="grid gap-4 sm:grid-cols-3 rounded-xl bg-primary/5 border border-primary/20 p-4">
                <div>
                  <p className="text-[10px] font-bold text-foreground/40 uppercase">
                    Total Contract Value
                  </p>
                  <p className="font-bold text-foreground mt-1">
                    {money(billingPlanContext.totalAmount, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-foreground/40 uppercase">
                    Milestone / Stage
                  </p>
                  <p className="font-bold text-foreground mt-1 text-primary">
                    {billingPlanContext.stageName}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-foreground/40 uppercase">
                    Scheduled Amount
                  </p>
                  <p className="font-bold text-foreground mt-1">
                    {money(billingPlanContext.amount, currency)}
                  </p>
                </div>
              </div>
            </Section>
          )}

          {/* ── Section 3: Items ── */}
          <Section
            icon={List}
            title="Invoice Items"
            subtitle="Detailed billing rows with pricing and automatic updates"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase w-6" />
                    <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase">
                      Item / Service
                    </th>
                    <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase w-20">
                      Qty
                    </th>
                    <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase w-28">
                      Unit Price
                    </th>
                    <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase w-20">
                      Tax %
                    </th>
                    <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase w-24">
                      Discount
                    </th>
                    <th className="pb-2 text-right text-xs font-bold text-foreground/40 uppercase w-28">
                      Amount
                    </th>
                    <th className="pb-2 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => (
                    <tr key={item._key} className="group">
                      <td className="py-2 pr-2 text-foreground/30">
                        <GripVertical className="h-4 w-4 cursor-grab" />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(item._key, 'name', e.target.value)}
                          placeholder="Service description"
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item._key, 'description', e.target.value)}
                          placeholder="Short memo detail (optional)"
                          className="mt-1 w-full rounded-lg border border-transparent bg-muted/30 px-2.5 py-1 text-xs text-foreground/60 outline-none focus:border-border"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          value={item.quantity}
                          min={1}
                          onChange={(e) =>
                            updateItem(item._key, 'quantity', Number(e.target.value))
                          }
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-right text-foreground outline-none focus:border-primary"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          min={0}
                          onChange={(e) =>
                            updateItem(item._key, 'unitPrice', Number(e.target.value))
                          }
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-right text-foreground outline-none focus:border-primary"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          value={item.taxRate}
                          min={0}
                          max={100}
                          onChange={(e) => updateItem(item._key, 'taxRate', Number(e.target.value))}
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-right text-foreground outline-none focus:border-primary"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          value={item.discount}
                          min={0}
                          onChange={(e) =>
                            updateItem(item._key, 'discount', Number(e.target.value))
                          }
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-right text-foreground outline-none focus:border-primary"
                        />
                      </td>
                      <td className="py-2 text-right font-bold text-foreground">
                        {money(itemTotal(item), currency)}
                      </td>
                      <td className="py-2 pl-2">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => duplicateItem(item._key)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-foreground/50 hover:text-foreground transition"
                            title="Duplicate"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item._key)}
                            disabled={items.length === 1}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-danger/10 text-foreground/50 hover:text-danger transition disabled:opacity-30"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={addItem}
                className="border border-dashed border-border text-sm gap-1.5"
              >
                <Plus className="h-4 w-4" /> Add Item
              </Button>
              <div className="flex items-center gap-3 text-sm">
                <label className="text-xs font-bold text-foreground/60">
                  Global Discount
                  <input
                    type="number"
                    value={globalDiscount}
                    min={0}
                    onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                    className="ml-2 w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-right text-foreground outline-none focus:border-primary"
                  />
                </label>
              </div>
            </div>
          </Section>

          {/* ── Section 4: Project Summary Context (If linked) ── */}
          {selectedProject && (
            <Section
              icon={CreditCard}
              title="Project Context Summary"
              subtitle="Project manager and schedule details"
              defaultOpen={false}
            >
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <Field
                  label="Project Code"
                  value={selectedProject.projectCode}
                  onChange={() => {}}
                  className="opacity-70"
                />
                <Field
                  label="Status"
                  value={selectedProject.status}
                  onChange={() => {}}
                  className="opacity-70"
                />
                <Field
                  label="Start Date"
                  value={
                    selectedProject.startDate ? String(selectedProject.startDate).slice(0, 10) : ''
                  }
                  onChange={() => {}}
                  className="opacity-70"
                />
                <Field
                  label="Deadline / Target"
                  value={
                    selectedProject.deadline ? String(selectedProject.deadline).slice(0, 10) : ''
                  }
                  onChange={() => {}}
                  className="opacity-70"
                />
              </div>
            </Section>
          )}

          {/* ── Section 5: Payment Info ── */}
          <Section
            icon={Layers}
            title="Payment Instructions"
            subtitle="Account details visible on PDF invoices"
          >
            <div className="grid gap-4 sm:grid-cols-1">
              <SelectField
                label="Preferred Payment Method"
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  ['Bank Transfer', 'Bank Transfer (ACH / Wire)'],
                  ['UPI', 'UPI Payment'],
                  ['Online Payment', 'Stripe / Online Cards'],
                ]}
              />
              <Textarea
                label="Account Numbers / Routing details / UPI / Instructions"
                value={paymentInstructions}
                onChange={setPaymentInstructions}
                placeholder="Include your bank IBAN, routing codes, or billing guidelines..."
                rows={4}
              />
            </div>
          </Section>

          {/* ── Section 6: Invoice Notes ── */}
          <Section
            icon={ScrollText}
            title="Invoice Notes (visible to Client)"
            subtitle="General instructions or client gratitude memo"
            defaultOpen={false}
          >
            <Textarea
              label="Invoice Notes"
              value={notes}
              onChange={setNotes}
              placeholder="e.g. Thank you for choosing ClientFlow. Please resolve before due date."
              rows={3}
            />
            <div className="mt-4">
              <Textarea
                label="Terms & Conditions (visible on invoice document)"
                value={termsConditions}
                onChange={setTermsConditions}
                rows={4}
              />
            </div>
          </Section>

          {/* ── Section 7: Attachments ── */}
          <Section
            icon={Paperclip}
            title="Reference Attachments"
            subtitle="PO, contracts, or work order links"
            defaultOpen={false}
          >
            <div className="grid gap-3">
              {attachments.map((att, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                  <Field
                    label={i === 0 ? 'File Name' : ''}
                    value={att.name}
                    onChange={(v) => updateAttachment(i, 'name', v)}
                    placeholder="Work_Order.pdf"
                  />
                  <Field
                    label={i === 0 ? 'URL Link' : ''}
                    value={att.url}
                    onChange={(v) => updateAttachment(i, 'url', v)}
                    placeholder="https://..."
                  />
                  <div>
                    {i === 0 && <p className="text-xs font-bold text-foreground/60 mb-1">Type</p>}
                    <select
                      value={att.type}
                      onChange={(e) => updateAttachment(i, 'type', e.target.value)}
                      className="h-10 rounded-xl border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary"
                    >
                      {(['PDF', 'CONTRACT', 'PO', 'REQUIREMENT', 'OTHER'] as const).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-danger/10 text-foreground/40 hover:text-danger transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                onClick={addAttachment}
                className="border border-dashed border-border text-sm gap-1.5 w-fit"
              >
                <Plus className="h-4 w-4" /> Add Attachment
              </Button>
            </div>
          </Section>

          {/* ── Section 8: Internal Notes ── */}
          <Section
            icon={Lock}
            title="Internal Staff Notes"
            subtitle="Staff-only internal ledger memo — never visible on PDF"
            defaultOpen={false}
          >
            <Textarea
              label="Staff Notes"
              value={internalNotes}
              onChange={setInternalNotes}
              placeholder="e.g. Waiting on Client approval before processing bank transfer..."
              rows={4}
            />
          </Section>

          {/* ── Footer Actions ── */}
          <div className="flex flex-wrap gap-3 justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/invoices?tab=invoices')}
              className="border border-border"
            >
              <X className="h-4 w-4" /> Cancel
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => save('DRAFT')}
                disabled={saving}
                className="border border-border gap-1.5"
              >
                <Save className="h-4 w-4" /> Save Draft
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  notify({ type: 'info', title: 'Preview', message: 'PDF preview coming soon' })
                }
                className="border border-border gap-1.5"
              >
                <Eye className="h-4 w-4" /> Preview
              </Button>
              <Button
                type="button"
                onClick={() => save('SENT')}
                disabled={saving}
                className="gap-1.5"
              >
                <Send className="h-4 w-4" /> {saving ? 'Saving...' : 'Save & Send'}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Right: Sticky Summary Panel ── */}
        <div className="xl:sticky xl:top-6 xl:self-start grid gap-3">
          {/* Totals Card */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" />
              Summary
            </h3>
            <div className="grid gap-2.5 text-sm">
              <div className="flex justify-between text-foreground/70">
                <span>Subtotal</span>
                <span className="font-medium">{money(totals.subtotal, currency)}</span>
              </div>
              {totals.tax > 0 && (
                <div className="flex justify-between text-foreground/70">
                  <span>Tax</span>
                  <span className="font-medium">{money(totals.tax, currency)}</span>
                </div>
              )}
              {totals.itemDiscounts + globalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="font-medium">
                    −{money(totals.itemDiscounts + globalDiscount, currency)}
                  </span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between font-semibold text-foreground">
                <span>Grand Total</span>
                <span>{money(totals.total, currency)}</span>
              </div>
              {amountPaid > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Amount Paid</span>
                  <span>{money(amountPaid, currency)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2.5 flex justify-between font-bold text-base text-foreground">
                <span>Balance Due</span>
                <span className={balanceDue > 0 ? 'text-primary' : 'text-emerald-600'}>
                  {money(balanceDue, currency)}
                </span>
              </div>
            </div>
          </Card>

          {/* Client card */}
          {selectedClient && (
            <Card className="p-5">
              <h3 className="text-xs font-bold text-foreground/50 uppercase mb-3">Invoice To</h3>
              <p className="font-bold text-foreground">{selectedClient.companyName}</p>
              <p className="text-xs text-foreground/60 mt-1">{selectedClient.email}</p>
              <p className="text-xs text-foreground/60 mt-0.5">{selectedClient.billingAddress}</p>
            </Card>
          )}

          {/* Invoice status metrics */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div>
                <p className="text-foreground/40 uppercase font-bold">Paid Status</p>
                <p
                  className={`text-sm font-bold mt-1 ${balanceDue === 0 ? 'text-emerald-600' : 'text-amber-500'}`}
                >
                  {balanceDue === 0 ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'UNPAID'}
                </p>
              </div>
              <div>
                <p className="text-foreground/40 uppercase font-bold">Due Days</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {Math.max(0, Math.round((new Date(dueDate).getTime() - Date.now()) / 86400000))}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
