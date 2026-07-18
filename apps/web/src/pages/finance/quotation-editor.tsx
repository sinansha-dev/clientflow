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
} from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useToastStore } from '../../stores/toast-store';
import { errorMessage } from '../../lib/errors';
import { DocumentPreview } from '../../components/finance/document-preview';
import type {
  Client,
  Project,
  Quotation,
  QuotationBillingDraft,
  QuotationAttachment,
} from '@clientflow/types';

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

interface BillingStageRow {
  _key: string;
  name: string;
  percentage: number;
  dueDate: string;
}

type BillingType = 'FULL_PAYMENT' | 'ADVANCE_BALANCE' | 'MILESTONE' | 'MONTHLY_RETAINER' | 'AMC';

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

const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  FULL_PAYMENT: 'Full Payment',
  ADVANCE_BALANCE: 'Advance + Balance',
  MILESTONE: 'Milestone Billing',
  MONTHLY_RETAINER: 'Monthly Retainer',
  AMC: 'AMC / Recurring',
};

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
        className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary"
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

export function QuotationEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const notify = useToastStore((s) => s.notify);

  const isEditing = Boolean(id);

  // ── Data loading ──
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Section 1: Basic Info ──
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('Auto-generated');
  const [title, setTitle] = useState('');
  const [quoteDate, setQuoteDate] = useState(today);
  const [validUntil, setValidUntil] = useState(nextMonth);
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState('DRAFT');
  const [description, setDescription] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // ── Section 2: Items ──
  const [items, setItems] = useState<LineItem[]>([
    { _key: uid(), name: '', description: '', quantity: 1, unitPrice: 0, taxRate: 18, discount: 0 },
  ]);
  const [globalDiscount, setGlobalDiscount] = useState(0);

  // ── Section 3: Scope ──
  const [scope, setScope] = useState('');

  // ── Section 4: Billing Plan ──
  const [billingType, setBillingType] = useState<BillingType>('FULL_PAYMENT');
  const [billingStages, setBillingStages] = useState<BillingStageRow[]>([
    { _key: uid(), name: 'Advance', percentage: 50, dueDate: '' },
    { _key: uid(), name: 'Balance', percentage: 50, dueDate: '' },
  ]);
  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [retainerStart, setRetainerStart] = useState(today);
  const [retainerDuration, setRetainerDuration] = useState(12);
  const [amcInterval, setAmcInterval] = useState('MONTHLY');

  // ── Section 5: Terms ──
  const [termsConditions, setTermsConditions] = useState('');

  // ── Section 6: Attachments ──
  const [attachments, setAttachments] = useState<QuotationAttachment[]>([]);

  // ── Section 7: Internal Notes ──
  const [internalNotes, setInternalNotes] = useState('');
  const [notes, setNotes] = useState('');

  // ── Computed ──
  const totals = useMemo(() => calcTotals(items, globalDiscount), [items, globalDiscount]);

  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);

  const projectOptions = useMemo(
    () => projects.filter((p) => !clientId || p.clientId === clientId),
    [projects, clientId],
  );

  const billingPctTotal = useMemo(
    () => billingStages.reduce((s, r) => s + Number(r.percentage), 0),
    [billingStages],
  );

  const billingBreakdown = useMemo(() => {
    if (billingType === 'FULL_PAYMENT') {
      return [{ name: 'Full Payment', amount: totals.total }];
    }
    if (billingType === 'MONTHLY_RETAINER' || billingType === 'AMC') {
      return [{ name: `${amcInterval} Amount`, amount: monthlyAmount }];
    }
    return billingStages.map((s) => ({
      name: s.name,
      amount: (totals.total * s.percentage) / 100,
    }));
  }, [billingType, billingStages, totals.total, monthlyAmount, amcInterval]);

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
          const qRes = await api.get('/quotations');
          const q: Quotation = (qRes.data.data as Quotation[]).find((x) => x.id === id)!;
          if (!q) throw new Error('Quotation not found');
          setClientId(q.clientId);
          setProjectId(q.projectId ?? '');
          setQuoteNumber(q.quoteNumber);
          setTitle(q.title);
          setQuoteDate(q.quoteDate ? String(q.quoteDate).slice(0, 10) : today);
          setValidUntil(String(q.validUntil).slice(0, 10));
          setCurrency(q.currency ?? 'USD');
          setStatus(q.status);
          setDescription(q.description ?? '');
          setNotes(q.notes ?? '');
          setScope(q.scope ?? '');
          setTermsConditions(q.termsConditions ?? '');
          setInternalNotes(q.internalNotes ?? '');
          setGlobalDiscount(q.discount ?? 0);
          setAttachments((q.attachments as QuotationAttachment[]) ?? []);

          if (q.items && q.items.length > 0) {
            setItems(
              q.items.map((i) => ({
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

          if (q.billingPlanDraft) {
            const d = q.billingPlanDraft as QuotationBillingDraft;
            setBillingType(d.billingType as BillingType);
            if (d.stages?.length) {
              setBillingStages(
                d.stages.map((s) => ({
                  _key: uid(),
                  name: s.name,
                  percentage: s.percentage,
                  dueDate: s.dueDate ?? '',
                })),
              );
            }
            if (d.monthlyAmount) setMonthlyAmount(d.monthlyAmount);
            if (d.retainerStart) setRetainerStart(d.retainerStart.slice(0, 10));
            if (d.retainerDuration) setRetainerDuration(d.retainerDuration);
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

  // ── Billing stage helpers ──
  const addStage = () =>
    setBillingStages((prev) => [...prev, { _key: uid(), name: '', percentage: 0, dueDate: '' }]);

  const removeStage = (key: string) =>
    setBillingStages((prev) => prev.filter((s) => s._key !== key));

  const updateStage = (key: string, field: keyof BillingStageRow, value: string | number) =>
    setBillingStages((prev) => prev.map((s) => (s._key === key ? { ...s, [field]: value } : s)));

  // ── Attachment helpers ──
  const addAttachment = () =>
    setAttachments((prev) => [...prev, { name: '', url: '', type: 'PDF' }]);
  const removeAttachment = (i: number) =>
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  const updateAttachment = (i: number, field: keyof QuotationAttachment, value: string) =>
    setAttachments((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));

  // ── Build billing plan draft ──
  const buildBillingPlanDraft = (): QuotationBillingDraft => {
    const stagesWithAmount = billingStages.map((s) => ({
      name: s.name,
      percentage: Number(s.percentage),
      amount: (totals.total * Number(s.percentage)) / 100,
      dueDate: s.dueDate || null,
    }));

    if (billingType === 'FULL_PAYMENT') {
      return {
        billingType: 'FULL_PAYMENT',
        stages: [{ name: 'Full Payment', percentage: 100, amount: totals.total, dueDate: null }],
      };
    }
    if (billingType === 'MONTHLY_RETAINER' || billingType === 'AMC') {
      return {
        billingType,
        stages: [],
        monthlyAmount,
        retainerStart,
        retainerDuration,
      };
    }
    return { billingType, stages: stagesWithAmount };
  };

  // ── Save ──
  const save = async (nextStatus?: string) => {
    if (!clientId) {
      notify({ type: 'error', title: 'Validation', message: 'Please select a client.' });
      return;
    }
    if (!title.trim()) {
      notify({ type: 'error', title: 'Validation', message: 'Title is required.' });
      return;
    }
    if (items.some((i) => !i.name.trim())) {
      notify({ type: 'error', title: 'Validation', message: 'All items must have a name.' });
      return;
    }
    if (
      (billingType === 'ADVANCE_BALANCE' || billingType === 'MILESTONE') &&
      billingPctTotal !== 100
    ) {
      notify({
        type: 'error',
        title: 'Billing Plan',
        message: `Stage percentages must total 100% (currently ${billingPctTotal}%).`,
      });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        clientId,
        projectId: projectId || undefined,
        title,
        description: description || undefined,
        quoteDate,
        validUntil,
        currency,
        status: nextStatus ?? status,
        notes: notes || undefined,
        scope: scope || undefined,
        termsConditions: termsConditions || undefined,
        internalNotes: internalNotes || undefined,
        discount: globalDiscount,
        billingPlanDraft: buildBillingPlanDraft(),
        attachments: attachments.filter((a) => a.name && a.url),
        items: items.map((i) => ({
          name: i.name,
          description: i.description || undefined,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
        })),
      };

      if (isEditing) {
        await api.patch(`/quotations/${id}`, payload);
        notify({ type: 'success', title: 'Quotation updated' });
      } else {
        await api.post('/quotations', payload);
        notify({ type: 'success', title: 'Quotation created' });
      }
      navigate('/invoices?tab=quotes');
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
          <p className="text-sm text-foreground/55">Finance / Quotations</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {isEditing ? `Edit Quotation — ${quoteNumber}` : 'New Quotation'}
          </h1>
          <p className="mt-1 text-sm text-foreground/55">
            {isEditing
              ? 'Update the quotation details and billing plan.'
              : 'Create a professional quotation with a billing plan for your client.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/invoices?tab=quotes')}
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
            title="Basic Information"
            subtitle="Client, project, and quotation details"
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
                  ['', 'No project (new)'] as [string, string],
                  ...projectOptions.map((p) => [p.id, p.projectName] as [string, string]),
                ]}
              />
              <Field
                label="Quote Number"
                value={quoteNumber}
                onChange={() => {}}
                className="opacity-60"
              />
              <Field
                label="Title"
                value={title}
                onChange={setTitle}
                required
                placeholder="e.g. E-Commerce Website Development"
              />
              <Field label="Quote Date" type="date" value={quoteDate} onChange={setQuoteDate} />
              <Field
                label="Valid Until"
                type="date"
                value={validUntil}
                onChange={setValidUntil}
                required
              />
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
                  ['ACCEPTED', 'Accepted'],
                  ['REJECTED', 'Rejected'],
                  ['EXPIRED', 'Expired'],
                ]}
              />
              <div className="sm:col-span-2">
                <Textarea
                  label="Short Description"
                  value={description}
                  onChange={setDescription}
                  placeholder="Brief overview of this quotation..."
                  rows={2}
                />
              </div>
            </div>
          </Section>

          {/* ── Section 2: Items ── */}
          <Section
            icon={List}
            title="Items / Services"
            subtitle="Add line items with pricing, tax and discounts"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase w-6" />
                    <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase">
                      Service / Item
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
                          placeholder="Service name"
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item._key, 'description', e.target.value)}
                          placeholder="Description (optional)"
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

          {/* ── Section 3: Project Scope ── */}
          <Section
            icon={ScrollText}
            title="Project Scope"
            subtitle="Define deliverables, assumptions and responsibilities"
            defaultOpen={false}
          >
            <Textarea
              label="Scope of Work, Deliverables, Assumptions, Out of Scope, Client Responsibilities"
              value={scope}
              onChange={setScope}
              placeholder={`Scope of Work:\n- Design and development of a responsive e-commerce website\n\nDeliverables:\n- Wireframes & UI designs\n- Frontend & backend development\n- Deployment to production\n\nAssumptions:\n- Client will provide content within 5 business days\n\nOut of Scope:\n- Mobile app development\n\nClient Responsibilities:\n- Timely feedback and approvals`}
              rows={12}
            />
          </Section>

          {/* ── Section 4: Billing Plan ── */}
          <Section
            icon={Layers}
            title="Billing Plan"
            subtitle="Define how and when the client will be invoiced"
          >
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 mb-6">
              {(Object.keys(BILLING_TYPE_LABELS) as BillingType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBillingType(t)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-bold text-center transition ${
                    billingType === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground/60 hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {BILLING_TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Full Payment */}
            {billingType === 'FULL_PAYMENT' && (
              <div className="rounded-xl bg-muted/30 border border-border p-4 text-sm text-foreground/70">
                <CheckCircle className="inline h-4 w-4 text-emerald-500 mr-2" />
                100% of the total amount will be invoiced upon project approval.
              </div>
            )}

            {/* Advance + Balance or Milestone */}
            {(billingType === 'ADVANCE_BALANCE' || billingType === 'MILESTONE') && (
              <div className="grid gap-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase">
                          Stage Name
                        </th>
                        <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase w-28">
                          Percentage %
                        </th>
                        <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase w-36">
                          Amount
                        </th>
                        <th className="pb-2 text-left text-xs font-bold text-foreground/40 uppercase w-36">
                          Due Date
                        </th>
                        <th className="pb-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {billingStages.map((stage) => {
                        const stageAmount = (totals.total * Number(stage.percentage)) / 100;
                        return (
                          <tr key={stage._key}>
                            <td className="py-2 pr-3">
                              <input
                                type="text"
                                value={stage.name}
                                onChange={(e) => updateStage(stage._key, 'name', e.target.value)}
                                placeholder="e.g. Design Approved"
                                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="number"
                                value={stage.percentage}
                                min={0}
                                max={100}
                                onChange={(e) =>
                                  updateStage(stage._key, 'percentage', Number(e.target.value))
                                }
                                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-right text-foreground outline-none focus:border-primary"
                              />
                            </td>
                            <td className="py-2 pr-3 text-right font-bold text-foreground">
                              {money(stageAmount, currency)}
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="date"
                                value={stage.dueDate}
                                onChange={(e) => updateStage(stage._key, 'dueDate', e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                              />
                            </td>
                            <td className="py-2">
                              <button
                                type="button"
                                onClick={() => removeStage(stage._key)}
                                disabled={billingStages.length <= 1}
                                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-danger/10 text-foreground/40 hover:text-danger transition disabled:opacity-30"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={addStage}
                    className="border border-dashed border-border text-sm gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Add Stage
                  </Button>
                  <div
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                      billingPctTotal === 100
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-danger/10 text-danger'
                    }`}
                  >
                    {billingPctTotal === 100 ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5" />
                    )}
                    Total: {billingPctTotal}% {billingPctTotal !== 100 && '(must equal 100%)'}
                  </div>
                </div>
              </div>
            )}

            {/* Monthly Retainer */}
            {billingType === 'MONTHLY_RETAINER' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Monthly Amount"
                  type="number"
                  value={monthlyAmount}
                  onChange={(v) => setMonthlyAmount(Number(v))}
                />
                <Field
                  label="Start Date"
                  type="date"
                  value={retainerStart}
                  onChange={setRetainerStart}
                />
                <Field
                  label="Duration (months)"
                  type="number"
                  value={retainerDuration}
                  onChange={(v) => setRetainerDuration(Number(v))}
                />
              </div>
            )}

            {/* AMC */}
            {billingType === 'AMC' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Billing Interval"
                  value={amcInterval}
                  onChange={setAmcInterval}
                  options={[
                    ['MONTHLY', 'Monthly'],
                    ['QUARTERLY', 'Quarterly'],
                    ['YEARLY', 'Yearly'],
                  ]}
                />
                <Field
                  label="Amount per Interval"
                  type="number"
                  value={monthlyAmount}
                  onChange={(v) => setMonthlyAmount(Number(v))}
                />
                <Field
                  label="Start Date"
                  type="date"
                  value={retainerStart}
                  onChange={setRetainerStart}
                />
              </div>
            )}
          </Section>

          {/* ── Section 5: Terms & Conditions ── */}
          <Section
            icon={ScrollText}
            title="Terms & Conditions"
            subtitle="Payment terms, warranties, and policies"
            defaultOpen={false}
          >
            <Textarea
              label="Terms & Conditions"
              value={termsConditions}
              onChange={setTermsConditions}
              placeholder={`Payment Terms:\nPayment is due within 30 days of invoice date.\n\nSupport Period:\n3 months of bug-fix support included post-delivery.\n\nRevision Policy:\nUp to 3 rounds of revisions per design phase.\n\nWarranty:\nWe guarantee the delivered software will be free of critical defects for 60 days.\n\nCancellation Policy:\nAdvance payments are non-refundable after work begins.`}
              rows={10}
            />
            <div className="mt-4">
              <Textarea
                label="Additional Notes (visible on quotation document)"
                value={notes}
                onChange={setNotes}
                placeholder="Any additional notes for the client..."
                rows={3}
              />
            </div>
          </Section>

          {/* ── Section 6: Attachments ── */}
          <Section
            icon={Paperclip}
            title="Attachments"
            subtitle="Reference documents and supporting files"
            defaultOpen={false}
          >
            <div className="grid gap-3">
              {attachments.map((att, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                  <Field
                    label={i === 0 ? 'File Name' : ''}
                    value={att.name}
                    onChange={(v) => updateAttachment(i, 'name', v)}
                    placeholder="Proposal.pdf"
                  />
                  <Field
                    label={i === 0 ? 'URL / Link' : ''}
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
                      {(['PDF', 'DOC', 'MOCKUP', 'CONTRACT', 'REQUIREMENT', 'OTHER'] as const).map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ),
                      )}
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

          {/* ── Section 7: Internal Notes ── */}
          <Section
            icon={Lock}
            title="Internal Notes"
            subtitle="Staff-only — not visible to the client"
            defaultOpen={false}
          >
            <Textarea
              label="Internal Notes"
              value={internalNotes}
              onChange={setInternalNotes}
              placeholder="e.g. Client negotiated a 5% discount. Follow up if not accepted by end of month..."
              rows={5}
            />
          </Section>

          {/* ── Footer Actions ── */}
          <div className="flex flex-wrap gap-3 justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/invoices?tab=quotes')}
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
                onClick={() => setIsPreviewOpen(true)}
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
                <Send className="h-4 w-4" /> {saving ? 'Saving...' : 'Send to Client'}
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
              <div className="border-t border-border pt-2.5 flex justify-between font-bold text-base text-foreground">
                <span>Grand Total</span>
                <span className="text-primary">{money(totals.total, currency)}</span>
              </div>
            </div>
          </Card>

          {/* Billing Breakdown Card */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              Billing Plan
            </h3>
            <p className="text-xs text-foreground/50 mb-4">{BILLING_TYPE_LABELS[billingType]}</p>
            <div className="grid gap-2 text-sm">
              {billingBreakdown.map((b, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-foreground/70 text-xs">{b.name}</span>
                  <span className="font-bold text-foreground">{money(b.amount, currency)}</span>
                </div>
              ))}
              {(billingType === 'ADVANCE_BALANCE' || billingType === 'MILESTONE') && (
                <div
                  className={`mt-2 flex items-center gap-1.5 text-xs font-bold rounded-lg px-2.5 py-1.5 ${
                    billingPctTotal === 100
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-danger/10 text-danger'
                  }`}
                >
                  {billingPctTotal === 100 ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5" />
                  )}
                  {billingPctTotal}% allocated
                </div>
              )}
            </div>
          </Card>

          {/* Client card */}
          {selectedClient && (
            <Card className="p-5">
              <h3 className="text-xs font-bold text-foreground/50 uppercase mb-3">Prepared For</h3>
              <p className="font-bold text-foreground">{selectedClient.companyName}</p>
              <p className="text-xs text-foreground/60 mt-1">{selectedClient.email}</p>
              <p className="text-xs text-foreground/60 mt-0.5">{selectedClient.billingAddress}</p>
              {selectedClient.taxNumber && (
                <p className="text-xs text-foreground/50 mt-0.5">GST: {selectedClient.taxNumber}</p>
              )}
            </Card>
          )}

          {/* Items count */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div>
                <p className="text-foreground/40 uppercase font-bold">Items</p>
                <p className="text-xl font-bold text-foreground mt-1">{items.length}</p>
              </div>
              <div>
                <p className="text-foreground/40 uppercase font-bold">Valid Days</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {Math.max(
                    0,
                    Math.round((new Date(validUntil).getTime() - Date.now()) / 86400000),
                  )}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <DocumentPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        documentType="QUOTATION"
        data={{
          id,
          title,
          number: quoteNumber === 'Auto-generated' ? '' : quoteNumber,
          issueDate: quoteDate,
          validUntil,
          currency,
          status,
          client: selectedClient,
          project: projects.find((p) => p.id === projectId),
          items,
          globalDiscount,
          notes,
          scope,
          termsConditions,
          billingType,
          billingStages,
          monthlyAmount,
          retainerStart,
          retainerDuration,
          billingBreakdown,
        }}
      />
    </div>
  );
}
