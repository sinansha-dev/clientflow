import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToastStore } from '../../stores/toast-store';
import { errorMessage } from '../../lib/errors';
import type {
  Client,
  Expense,
  FinanceSummary,
  Invoice,
  Payment,
  Project,
  Quotation,
} from '@clientflow/types';
import {
  Check,
  FileText,
  Plus,
  Receipt,
  RefreshCcw,
  Send,
  WalletCards,
  Layers,
  FileSpreadsheet,
  Zap,
  Download,
  Pencil,
} from 'lucide-react';

type Tab =
  | 'overview'
  | 'quotes'
  | 'billing-plans'
  | 'invoices'
  | 'payments'
  | 'recurring'
  | 'expenses'
  | 'reports';

type DocKind = 'quotation' | 'invoice' | 'payment' | 'expense' | 'recurring-service';

const today = new Date().toISOString().slice(0, 10);
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const money = (value = 0, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

export function FinanceWorkspacePage() {
  const navigate = useNavigate();
  const notify = useToastStore((state) => state.notify);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringServices, setRecurringServices] = useState<any[]>([]);
  const [openForm, setOpenForm] = useState<DocKind | null>(null);

  const [docForm, setDocForm] = useState({
    clientId: '',
    projectId: '',
    title: '',
    itemName: 'Professional services',
    quantity: 1,
    unitPrice: 0,
    taxRate: 0,
    discount: 0,
    validUntil: nextMonth,
    issueDate: today,
    dueDate: nextMonth,
    notes: '',
    type: 'PROJECT',
    billingPeriodFrom: '',
    billingPeriodTo: '',
    recurringServiceId: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    invoiceId: '',
    amount: 0,
    paymentMethod: 'Bank Transfer',
    referenceNumber: '',
    paymentDate: today,
    notes: '',
  });

  const [expenseForm, setExpenseForm] = useState({
    projectId: '',
    category: 'Operations',
    amount: 0,
    description: '',
    expenseDate: today,
    receiptUrl: '',
  });

  const [recurringForm, setRecurringForm] = useState({
    projectId: '',
    name: 'AMC Support',
    amount: 0,
    interval: 'MONTHLY',
    startDate: today,
  });

  const loadFinance = async () => {
    try {
      setLoading(true);
      const [
        reportRes,
        quoteRes,
        invoiceRes,
        paymentRes,
        expenseRes,
        clientRes,
        projectRes,
        recurringRes,
      ] = await Promise.all([
        api.get('/reports/finance'),
        api.get('/quotations'),
        api.get('/invoices'),
        api.get('/payments'),
        api.get('/expenses'),
        api.get('/clients?limit=1000'),
        api.get('/projects?limit=1000'),
        api.get('/recurring-services').catch(() => ({ data: { data: [] } })),
      ]);
      setSummary(reportRes.data.data);
      setQuotations(quoteRes.data.data ?? []);
      setInvoices(invoiceRes.data.data ?? []);
      setPayments(paymentRes.data.data ?? []);
      setExpenses(expenseRes.data.data ?? []);
      setClients(clientRes.data.data?.items ?? []);
      setProjects(projectRes.data.data?.items ?? []);
      setRecurringServices(recurringRes.data.data ?? []);
    } catch (err) {
      notify({ type: 'error', title: 'Finance load failed', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFinance();
  }, []);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === docForm.clientId),
    [clients, docForm.clientId],
  );

  const projectOptions = useMemo(
    () => projects.filter((project) => !docForm.clientId || project.clientId === docForm.clientId),
    [projects, docForm.clientId],
  );

  const itemPayload = [
    {
      name: docForm.itemName,
      quantity: Number(docForm.quantity),
      unitPrice: Number(docForm.unitPrice),
      taxRate: Number(docForm.taxRate),
    },
  ];

  const createDocument = async (kind: 'quotation' | 'invoice') => {
    try {
      if (!docForm.clientId) throw new Error('Select a client first');
      if (kind === 'quotation') {
        await api.post('/quotations', {
          clientId: docForm.clientId,
          projectId: docForm.projectId || undefined,
          title: docForm.title || docForm.itemName,
          validUntil: docForm.validUntil,
          discount: Number(docForm.discount),
          notes: docForm.notes,
          items: itemPayload,
        });
      } else {
        await api.post('/invoices', {
          clientId: docForm.clientId,
          projectId: docForm.projectId || undefined,
          issueDate: docForm.issueDate,
          dueDate: docForm.dueDate,
          currency: selectedClient?.currency ?? 'USD',
          discount: Number(docForm.discount),
          notes: docForm.notes,
          items: itemPayload,
          type: docForm.type,
          billingPeriodFrom:
            docForm.type === 'RECURRING' && docForm.billingPeriodFrom
              ? docForm.billingPeriodFrom
              : undefined,
          billingPeriodTo:
            docForm.type === 'RECURRING' && docForm.billingPeriodTo
              ? docForm.billingPeriodTo
              : undefined,
          recurringServiceId:
            docForm.type === 'RECURRING' && docForm.recurringServiceId
              ? docForm.recurringServiceId
              : undefined,
        });
      }
      notify({
        type: 'success',
        title: kind === 'quotation' ? 'Quotation created' : 'Invoice created',
      });
      setOpenForm(null);
      await loadFinance();
    } catch (err) {
      notify({ type: 'error', title: 'Save failed', message: errorMessage(err) });
    }
  };

  const recordPayment = async () => {
    try {
      await api.post('/payments', { ...paymentForm, amount: Number(paymentForm.amount) });
      notify({ type: 'success', title: 'Payment recorded' });
      setOpenForm(null);
      await loadFinance();
    } catch (err) {
      notify({ type: 'error', title: 'Payment failed', message: errorMessage(err) });
    }
  };

  const recordExpense = async () => {
    try {
      await api.post('/expenses', { ...expenseForm, amount: Number(expenseForm.amount) });
      notify({ type: 'success', title: 'Expense recorded' });
      setOpenForm(null);
      await loadFinance();
    } catch (err) {
      notify({ type: 'error', title: 'Expense failed', message: errorMessage(err) });
    }
  };

  const createRecurringService = async () => {
    try {
      await api.post('/recurring-services', {
        projectId: recurringForm.projectId,
        name: recurringForm.name,
        amount: Number(recurringForm.amount),
        interval: recurringForm.interval,
        startDate: recurringForm.startDate,
      });
      notify({ type: 'success', title: 'Recurring service created' });
      setOpenForm(null);
      await loadFinance();
    } catch (err) {
      notify({ type: 'error', title: 'Setup failed', message: errorMessage(err) });
    }
  };

  const updateRecurringServiceStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/recurring-services/${id}/status`, { status });
      notify({ type: 'success', title: `Service status updated to ${status.toLowerCase()}` });
      await loadFinance();
    } catch (err) {
      notify({ type: 'error', title: 'Status update failed', message: errorMessage(err) });
    }
  };

  const triggerCron = async () => {
    try {
      setLoading(true);
      const res = await api.post('/recurring-services/trigger-cron');
      notify({
        type: 'success',
        title: 'Cron Billing Executed',
        message: `Auto-generated ${res.data.data?.length || 0} invoice renewals successfully.`,
      });
      await loadFinance();
    } catch (err) {
      notify({ type: 'error', title: 'Trigger failed', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const action = async (url: string, title: string) => {
    try {
      await api.post(url);
      notify({ type: 'success', title });
      await loadFinance();
    } catch (err) {
      notify({ type: 'error', title: 'Action failed', message: errorMessage(err) });
    }
  };

  // Calculations for billing plans tab
  const projectsBillingPlans = useMemo(() => {
    return projects.map((p) => {
      const pInvoices = invoices.filter((i) => i.projectId === p.id);
      const invoiced = pInvoices.reduce((sum, i) => sum + i.total, 0);
      const paid = pInvoices.reduce((sum, i) => sum + i.amountPaid, 0);
      const balance = pInvoices.reduce((sum, i) => sum + i.balanceDue, 0);
      return {
        ...p,
        invoiced,
        paid,
        balance,
      };
    });
  }, [projects, invoices]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-foreground/55">Workspace / Finance</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">Finance</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Quotations, invoices, milestones, recurring services, and profit snapshots.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            className="border border-border"
            onClick={() => void loadFinance()}
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => navigate('/invoices/quotations/new')}>
            <Plus className="h-4 w-4" /> Quotation
          </Button>
          <Button onClick={() => navigate('/invoices/new')}>
            <Plus className="h-4 w-4" /> Invoice
          </Button>
          <Button
            onClick={() => setOpenForm('recurring-service')}
            variant="ghost"
            className="bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary"
          >
            <Plus className="h-4 w-4" /> Recurring Service
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Revenue', value: summary?.revenue, Icon: WalletCards },
          { label: 'Outstanding', value: summary?.outstanding, Icon: FileText },
          { label: 'Expenses', value: summary?.expenses, Icon: Receipt },
          { label: 'Profit', value: summary?.profit, Icon: Check },
        ].map(({ label, value, Icon }) => (
          <Card key={label} className="flex items-center justify-between p-5">
            <div>
              <p className="text-[10px] font-bold uppercase text-foreground/45">{label}</p>
              <p className="mt-2 text-2xl font-bold">{money(Number(value ?? 0))}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          </Card>
        ))}
      </div>

      {/* Finance Sub navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'quotes', label: 'Quotations' },
          { id: 'billing-plans', label: 'Billing Plans' },
          { id: 'invoices', label: 'Invoices' },
          { id: 'payments', label: 'Payments' },
          { id: 'recurring', label: 'Recurring Services' },
          { id: 'expenses', label: 'Expenses' },
          { id: 'reports', label: 'Reports' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id as Tab)}
            className={`px-3 py-3 text-sm font-bold border-b-2 transition ${
              tab === item.id
                ? 'border-primary text-primary font-extrabold'
                : 'border-transparent text-foreground/55 hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-12 text-center text-sm text-foreground/50">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading finance workspace data...
        </Card>
      ) : (
        <>
          {tab === 'overview' && (
            <DashboardPanel summary={summary} quotations={quotations} invoices={invoices} />
          )}

          {tab === 'quotes' && (
            <QuotationTable
              quotations={quotations}
              onSend={(id) => action(`/quotations/${id}/send`, 'Quotation sent')}
              onApprove={(id) => action(`/quotations/${id}/approve`, 'Quotation approved')}
              onConvert={(id) =>
                action(
                  `/quotations/${id}/convert-project`,
                  'Quotation converted to project. Billing plan auto-activated.',
                )
              }
              onEdit={(id) => navigate(`/invoices/quotations/${id}/edit`)}
            />
          )}

          {tab === 'billing-plans' && (
            <BillingPlanTable
              plans={projectsBillingPlans}
              onConfigure={(projectId) => navigate(`/projects/${projectId}?tab=billing`)}
            />
          )}

          {tab === 'invoices' && (
            <InvoiceTable
              invoices={invoices}
              onSend={(id) => action(`/invoices/${id}/send`, 'Invoice sent')}
              onPayment={(invoice) => {
                setPaymentForm((form) => ({
                  ...form,
                  invoiceId: invoice.id,
                  amount: invoice.balanceDue,
                }));
                setOpenForm('payment');
              }}
              onEdit={(id) => navigate(`/invoices/${id}/edit`)}
            />
          )}

          {tab === 'payments' && <PaymentTable payments={payments} />}

          {tab === 'recurring' && (
            <RecurringServicesTable
              services={recurringServices}
              onTrigger={triggerCron}
              onStatusChange={updateRecurringServiceStatus}
            />
          )}

          {tab === 'expenses' && (
            <ExpenseTable expenses={expenses} onAdd={() => setOpenForm('expense')} />
          )}

          {tab === 'reports' && <ReportsPanel summary={summary} />}
        </>
      )}

      {/* Invoice Form Modal (Quotation creation moved to dedicated page) */}
      {openForm === 'invoice' ? (
        <Modal title="New Invoice" onClose={() => setOpenForm(null)}>
          <DocumentForm
            form={docForm}
            setForm={setDocForm}
            clients={clients}
            projects={projectOptions}
            kind="invoice"
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenForm(null)}>
              Cancel
            </Button>
            <Button onClick={() => createDocument('invoice')}>Save</Button>
          </div>
        </Modal>
      ) : null}

      {openForm === 'payment' ? (
        <Modal title="Record Payment" onClose={() => setOpenForm(null)}>
          <PaymentForm
            form={paymentForm}
            setForm={setPaymentForm}
            invoices={invoices.filter((invoice) => invoice.balanceDue > 0)}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenForm(null)}>
              Cancel
            </Button>
            <Button onClick={recordPayment}>Record</Button>
          </div>
        </Modal>
      ) : null}

      {openForm === 'expense' ? (
        <Modal title="Add Expense" onClose={() => setOpenForm(null)}>
          <ExpenseForm form={expenseForm} setForm={setExpenseForm} projects={projects} />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenForm(null)}>
              Cancel
            </Button>
            <Button onClick={recordExpense}>Save</Button>
          </div>
        </Modal>
      ) : null}

      {openForm === 'recurring-service' ? (
        <Modal title="Add Recurring Service" onClose={() => setOpenForm(null)}>
          <RecurringServiceForm
            form={recurringForm}
            setForm={setRecurringForm}
            projects={projects}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenForm(null)}>
              Cancel
            </Button>
            <Button onClick={createRecurringService}>Create Service</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function DashboardPanel({
  summary,
  quotations,
  invoices,
}: {
  summary: FinanceSummary | null;
  quotations: Quotation[];
  invoices: Invoice[];
}) {
  return (
    <div className="grid gap-4 flex-col">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-bold">Open Pipeline</h2>
          <p className="mt-3 text-sm text-foreground/60">
            {summary?.draftQuotes ?? 0} draft quotations and {summary?.openInvoices ?? 0} open
            invoices need attention.
          </p>
        </Card>
        <Card>
          <h2 className="text-base font-bold">Recent Documents</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {[...quotations.slice(0, 3), ...invoices.slice(0, 3)].slice(0, 5).map((item: any) => (
              <div
                key={item.id}
                className="flex justify-between border-b border-border pb-2 animate-fade-in"
              >
                <span className="font-semibold flex items-center gap-1.5">
                  {item.quoteNumber ?? item.invoiceNumber}
                  {item.type && item.type !== 'PROJECT' && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded border bg-muted font-bold tracking-wider">
                      {item.type}
                    </span>
                  )}
                </span>
                <span>{money(item.total, item.currency ?? 'USD')}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {summary?.mrr !== undefined && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-2">
          <Card className="p-5 flex items-center justify-between border border-border shadow-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase text-foreground/45">
                Monthly Recurring Revenue (MRR)
              </span>
              <p className="text-2xl font-bold mt-2 text-primary">
                {money(Number(summary.mrr || 0))}
              </p>
              <span className="text-[10px] text-foreground/50 mt-1 block font-medium">
                ARR Target: {money(Number(summary.arr || 0))} / yr
              </span>
            </div>
            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-xs">
              MRR
            </div>
          </Card>
          <Card className="p-5 flex items-center justify-between border border-border shadow-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase text-foreground/45">
                Active Retainer Contracts
              </span>
              <p className="text-2xl font-bold mt-2 text-emerald-600">
                {summary.activeContracts || 0} active
              </p>
              <span className="text-[10px] text-foreground/50 mt-1 block font-medium">
                Paused: {summary.pausedContracts || 0} · Cancelled:{' '}
                {summary.cancelledContracts || 0}
              </span>
            </div>
            <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-xs">
              AMC
            </div>
          </Card>
          <Card className="p-5 flex items-center justify-between border border-border shadow-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase text-foreground/45">
                Billing Target Forecast
              </span>
              <p className="text-2xl font-bold mt-2 text-indigo-600">
                {money(Number(summary.revenueForecast || 0))}
              </p>
              <span className="text-[10px] text-foreground/50 mt-1 block font-medium">
                Realized Retainer Income: {money(Number(summary.recurringRevenue || 0))}
              </span>
            </div>
            <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-xs">
              FC
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function QuotationTable({
  quotations,
  onSend,
  onApprove,
  onConvert,
  onEdit,
}: {
  quotations: Quotation[];
  onSend: (id: string) => void;
  onApprove: (id: string) => void;
  onConvert: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  return (
    <Card className="overflow-x-auto p-0 border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left bg-muted/20">
            <th className="p-4 text-xs font-bold text-foreground/50 uppercase">Quote Number</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Client</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Status</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Total</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Valid Until</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {quotations.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center p-8 text-foreground/50">
                No quotations logged.
              </td>
            </tr>
          ) : (
            quotations.map((q) => (
              <tr key={q.id} className="border-b border-border hover:bg-muted/5 transition">
                <td className="p-4 font-bold text-foreground">
                  {q.quoteNumber}
                  <div className="font-normal text-xs text-foreground/55">{q.title}</div>
                </td>
                <td className="text-foreground/80">{q.client?.companyName}</td>
                <td>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      q.status === 'ACCEPTED'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : q.status === 'SENT'
                          ? 'bg-blue-500/10 text-blue-600'
                          : q.status === 'REJECTED'
                            ? 'bg-danger/10 text-danger'
                            : 'bg-amber-500/10 text-amber-600'
                    }`}
                  >
                    {q.status}
                  </span>
                </td>
                <td className="font-bold text-foreground">{money(q.total)}</td>
                <td className="text-foreground/60">
                  {new Date(q.validUntil).toLocaleDateString()}
                </td>
                <td className="flex items-center gap-2 py-3">
                  <Button
                    className="h-8 w-8 p-0"
                    variant="ghost"
                    onClick={() => onEdit(q.id)}
                    title="Edit quotation"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <a
                    href={`${api.defaults.baseURL}/quotations/${q.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 w-8 p-0 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-muted rounded-md transition"
                    title="Download PDF"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <Button
                    className="h-8 w-8 p-0"
                    variant="ghost"
                    onClick={() => onSend(q.id)}
                    title="Send quote"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                  {q.status !== 'ACCEPTED' && (
                    <>
                      <Button
                        className="h-8 w-8 p-0"
                        variant="ghost"
                        onClick={() => onApprove(q.id)}
                        title="Approve quote"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        className="h-8 px-3 text-xs font-bold"
                        onClick={() => onConvert(q.id)}
                        title="Setup project and activate billing plan"
                      >
                        Setup Project
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

function BillingPlanTable({
  plans,
  onConfigure,
}: {
  plans: any[];
  onConfigure: (id: string) => void;
}) {
  return (
    <Card className="overflow-x-auto p-0 border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left bg-muted/20">
            <th className="p-4 text-xs font-bold text-foreground/50 uppercase">Project Name</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Client</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Billing Plan</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Contract Budget</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Invoiced</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Paid / Outstanding</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {plans.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center p-8 text-foreground/50">
                No projects set up.
              </td>
            </tr>
          ) : (
            plans.map((p) => (
              <tr key={p.id} className="border-b border-border hover:bg-muted/5 transition">
                <td className="p-4 font-bold text-foreground">
                  {p.projectName}
                  <span className="text-[10px] text-foreground/50 block mt-0.5 uppercase font-mono">
                    Code: {p.projectCode}
                  </span>
                </td>
                <td className="text-foreground/85">{p.client?.companyName}</td>
                <td>
                  <span className="bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded text-[10px] font-bold">
                    {p.billingPlan?.billingType || 'CUSTOM'}
                  </span>
                </td>
                <td className="font-bold text-foreground">{money(p.budget)}</td>
                <td className="font-semibold text-foreground/60">{money(p.invoiced)}</td>
                <td className="text-xs font-bold text-foreground/80">
                  <span className="text-emerald-600">{money(p.paid)}</span> /{' '}
                  <span className="text-danger">{money(p.balance)}</span>
                </td>
                <td>
                  <Button
                    className="h-8 px-3 text-xs font-bold flex items-center gap-1"
                    onClick={() => onConfigure(p.id)}
                  >
                    <Layers className="h-3.5 w-3.5" /> Configure Plan
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

function InvoiceTable({
  invoices,
  onSend,
  onPayment,
  onEdit,
}: {
  invoices: Invoice[];
  onSend: (id: string) => void;
  onPayment: (invoice: Invoice) => void;
  onEdit: (id: string) => void;
}) {
  const [filter, setFilter] = useState<string>('ALL');

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filter === 'ALL') return true;
      if (filter === 'PROJECT') return inv.type === 'PROJECT';
      if (filter === 'ADVANCE') return inv.type === 'ADVANCE';
      if (filter === 'MILESTONE') return inv.type === 'MILESTONE';
      if (filter === 'RECURRING') return inv.type === 'RECURRING';
      if (filter === 'PAID') return inv.status === 'PAID';
      if (filter === 'OVERDUE') return inv.status === 'OVERDUE';
      if (filter === 'DRAFT') return inv.status === 'DRAFT';
      return true;
    });
  }, [invoices, filter]);

  return (
    <div className="grid gap-3">
      {/* Type & Status filter controls */}
      <div className="flex flex-wrap gap-1.5 p-3 border border-border rounded-xl bg-muted/10 items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PROJECT', label: 'Project' },
            { id: 'ADVANCE', label: 'Advance' },
            { id: 'MILESTONE', label: 'Milestone' },
            { id: 'RECURRING', label: 'Recurring' },
            { id: 'PAID', label: 'Paid' },
            { id: 'OVERDUE', label: 'Overdue' },
            { id: 'DRAFT', label: 'Draft' },
          ].map((item) => (
            <Button
              key={item.id}
              variant={filter === item.id ? 'primary' : 'ghost'}
              className="h-8 text-xs font-bold px-3 py-1"
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <span className="text-xs text-foreground/50 font-bold px-2">
          {filteredInvoices.length} invoices found
        </span>
      </div>

      <Card className="overflow-x-auto p-0 border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left bg-muted/20">
              <th className="p-4 text-xs font-bold text-foreground/50 uppercase">Invoice Number</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Client</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Status</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Total</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Balance Due</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Due Date</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-foreground/50">
                  No invoices match the selected filter.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((i) => (
                <tr
                  key={i.id}
                  className="border-b border-border hover:bg-muted/5 transition animate-fade-in"
                >
                  <td className="p-4 font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      {i.invoiceNumber}
                      {i.type && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-bold border tracking-wide uppercase ${
                            i.type === 'RECURRING'
                              ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                              : i.type === 'ADVANCE'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : i.type === 'MILESTONE'
                                  ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                                  : i.type === 'FINAL'
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                    : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                          }`}
                        >
                          {i.type.replace('_', ' ')}
                        </span>
                      )}
                    </span>
                    {i.project && (
                      <span className="text-[10px] text-foreground/50 block font-normal mt-0.5">
                        Project: {i.project.projectName}
                      </span>
                    )}
                    {i.type === 'RECURRING' && i.billingPeriodFrom && i.billingPeriodTo && (
                      <span className="text-[9px] text-foreground/55 font-medium block mt-0.5">
                        Period: {new Date(i.billingPeriodFrom).toLocaleDateString()} –{' '}
                        {new Date(i.billingPeriodTo).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  <td className="text-foreground/80">{i.client?.companyName}</td>
                  <td>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        i.status === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : i.status === 'PARTIALLY_PAID'
                            ? 'bg-indigo-500/10 text-indigo-600'
                            : i.status === 'SENT'
                              ? 'bg-blue-500/10 text-blue-600'
                              : i.status === 'OVERDUE'
                                ? 'bg-rose-500/10 text-rose-600'
                                : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {i.status}
                    </span>
                  </td>
                  <td className="font-bold text-foreground">{money(i.total, i.currency)}</td>
                  <td className="font-bold text-danger">{money(i.balanceDue, i.currency)}</td>
                  <td className="text-foreground/60">{new Date(i.dueDate).toLocaleDateString()}</td>
                  <td className="flex items-center gap-2 py-3">
                    <Button
                      className="h-8 w-8 p-0"
                      variant="ghost"
                      onClick={() => onEdit(i.id)}
                      title="Edit invoice"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <a
                      href={`${api.defaults.baseURL}/invoices/${i.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 w-8 p-0 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-muted rounded-md transition"
                      title="Download PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <Button
                      className="h-8 w-8 p-0"
                      variant="ghost"
                      onClick={() => onSend(i.id)}
                      title="Send invoice email"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    {i.balanceDue > 0 && (
                      <Button className="h-8 px-3 text-xs font-bold" onClick={() => onPayment(i)}>
                        Record Payment
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PaymentTable({ payments }: { payments: Payment[] }) {
  return (
    <Card className="overflow-x-auto p-0 border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left bg-muted/20">
            <th className="p-4 text-xs font-bold text-foreground/50 uppercase">Invoice Number</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Client</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Payment Method</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Reference</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Amount Paid</th>
            <th className="text-xs font-bold text-foreground/50 uppercase">Transaction Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center p-8 text-foreground/50">
                No payments recorded.
              </td>
            </tr>
          ) : (
            payments.map((p) => (
              <tr key={p.id} className="border-b border-border hover:bg-muted/5 transition">
                <td className="p-4 font-bold text-foreground">{p.invoice?.invoiceNumber}</td>
                <td className="text-foreground/80">{p.client?.companyName}</td>
                <td className="text-foreground/80 font-medium">{p.paymentMethod}</td>
                <td className="font-mono text-foreground/60">{p.referenceNumber || 'N/A'}</td>
                <td className="font-bold text-emerald-600">
                  {money(p.amount, p.invoice?.currency ?? 'USD')}
                </td>
                <td className="text-foreground/60">
                  {new Date(p.paymentDate).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

function RecurringServicesTable({
  services,
  onTrigger,
  onStatusChange,
}: {
  services: any[];
  onTrigger: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex justify-between items-center bg-primary/5 border border-primary/10 rounded-2xl p-4">
        <div>
          <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
            <Zap className="h-4 w-4" /> Simulate Billing Engine Run
          </h3>
          <p className="text-xs text-foreground/60 mt-0.5">
            Process active retainers and auto-generate draft invoices whose renewals are due.
          </p>
        </div>
        <Button
          onClick={onTrigger}
          variant="ghost"
          className="font-bold flex items-center gap-1 shadow-sm border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary h-10 px-4"
        >
          <RefreshCcw className="h-3.5 w-3.5" /> Run Billing Engine
        </Button>
      </div>

      <Card className="overflow-x-auto p-0 border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left bg-muted/20">
              <th className="p-4 text-xs font-bold text-foreground/50 uppercase">
                Service Retainer Name
              </th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Project / Client</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Interval</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Billing Rate</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Next Invoice Date</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Status</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-foreground/50">
                  No recurring services configured.
                </td>
              </tr>
            ) : (
              services.map((s) => (
                <tr key={s.id} className="border-b border-border hover:bg-muted/5 transition">
                  <td className="p-4 font-bold text-foreground">{s.name}</td>
                  <td>
                    {s.project?.projectName}
                    <span className="text-[10px] text-foreground/50 block font-normal mt-0.5">
                      {s.project?.client?.companyName}
                    </span>
                  </td>
                  <td className="font-semibold text-foreground/60">{s.interval}</td>
                  <td className="font-bold text-primary">{money(s.amount)}</td>
                  <td className="text-foreground/75 font-medium">
                    {new Date(s.nextInvoiceDate).toLocaleDateString()}
                  </td>
                  <td>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : s.status === 'PAUSED'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="flex items-center gap-1.5 py-3">
                    {s.status === 'ACTIVE' ? (
                      <Button
                        className="h-8 px-2.5 text-xs font-bold"
                        variant="ghost"
                        onClick={() => onStatusChange(s.id, 'PAUSED')}
                      >
                        Pause
                      </Button>
                    ) : (
                      <Button
                        className="h-8 px-2.5 text-xs font-bold"
                        variant="ghost"
                        onClick={() => onStatusChange(s.id, 'ACTIVE')}
                      >
                        Activate
                      </Button>
                    )}
                    {s.status !== 'CANCELLED' && (
                      <Button
                        className="h-8 px-2.5 text-xs font-bold text-danger hover:bg-danger/10"
                        variant="ghost"
                        onClick={() => onStatusChange(s.id, 'CANCELLED')}
                      >
                        Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ExpenseTable({ expenses, onAdd }: { expenses: Expense[]; onAdd: () => void }) {
  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <Button onClick={onAdd} className="font-bold">
          <Plus className="h-4 w-4" /> Expense
        </Button>
      </div>
      <Card className="overflow-x-auto p-0 border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left bg-muted/20">
              <th className="p-4 text-xs font-bold text-foreground/50 uppercase">Project</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Category</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Description</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Amount</th>
              <th className="text-xs font-bold text-foreground/50 uppercase">Expense Date</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center p-8 text-foreground/50">
                  No project expenses logged.
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="border-b border-border hover:bg-muted/5 transition">
                  <td className="p-4 font-bold text-foreground">{e.project?.projectName}</td>
                  <td className="text-foreground/80 font-medium">{e.category}</td>
                  <td className="text-foreground/70">{e.description}</td>
                  <td className="font-bold text-danger">{money(e.amount)}</td>
                  <td className="text-foreground/60">
                    {new Date(e.expenseDate).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ReportsPanel({ summary }: { summary: FinanceSummary | null }) {
  return (
    <Card className="p-6">
      <h2 className="text-base font-bold flex items-center gap-1.5 text-foreground mb-4">
        <FileSpreadsheet className="h-5 w-5 text-primary" /> Financial Reports Summary
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-sm">
        <div className="p-4 border border-border rounded-xl">
          <span className="text-xs text-foreground/45 uppercase tracking-wider block">
            Contract Billing Target
          </span>
          <span className="text-xl font-bold mt-1 block text-primary">
            {money(Number(summary?.revenue ?? 0) + Number(summary?.outstanding ?? 0))}
          </span>
        </div>
        <div className="p-4 border border-border rounded-xl">
          <span className="text-xs text-foreground/45 uppercase tracking-wider block">
            Actual Income Realized
          </span>
          <span className="text-xl font-bold mt-1 block text-emerald-600">
            {money(Number(summary?.revenue ?? 0))}
          </span>
        </div>
        <div className="p-4 border border-border rounded-xl">
          <span className="text-xs text-foreground/45 uppercase tracking-wider block">
            Realized Net Profit Margin
          </span>
          <span className="text-xl font-bold mt-1 block text-foreground">
            {money(Number(summary?.profit ?? 0))}
          </span>
        </div>
      </div>
    </Card>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="text-xs font-bold text-foreground/45 hover:text-foreground border border-border hover:bg-muted px-2.5 py-1 rounded-xl transition"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DocumentForm({
  form,
  setForm,
  clients,
  projects,
  kind,
}: {
  form: any;
  setForm: (fn: any) => void;
  clients: Client[];
  projects: Project[];
  kind: DocKind;
}) {
  const selectedProj = projects.find((p) => p.id === form.projectId);
  const recurringOptions = (selectedProj as any)?.recurringServices || [];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select
        label="Client"
        value={form.clientId}
        onChange={(value) => setForm((f: any) => ({ ...f, clientId: value, projectId: '' }))}
        options={clients.map((c) => [c.id, c.companyName])}
      />
      <Select
        label="Project"
        value={form.projectId}
        onChange={(value) => setForm((f: any) => ({ ...f, projectId: value }))}
        options={[['', 'No project'], ...projects.map((p) => [p.id, p.projectName])]}
      />
      {kind === 'invoice' && (
        <Select
          label="Invoice Type"
          value={form.type}
          onChange={(value) => setForm((f: any) => ({ ...f, type: value }))}
          options={[
            ['PROJECT', 'Project Invoice'],
            ['ADVANCE', 'Advance Invoice'],
            ['MILESTONE', 'Milestone Invoice'],
            ['FINAL', 'Final Invoice'],
            ['RECURRING', 'Recurring Invoice (AMC)'],
            ['CREDIT_NOTE', 'Credit Note'],
          ]}
        />
      )}
      {kind === 'invoice' && form.type === 'RECURRING' && recurringOptions.length > 0 && (
        <Select
          label="Linked AMC Contract"
          value={form.recurringServiceId}
          onChange={(value) => setForm((f: any) => ({ ...f, recurringServiceId: value }))}
          options={recurringOptions.map((s: any) => [s.id, s.name])}
        />
      )}
      <Field
        label={kind === 'quotation' ? 'Title' : 'Line Item'}
        value={kind === 'quotation' ? form.title : form.itemName}
        onChange={(value) =>
          setForm((f: any) => ({ ...f, [kind === 'quotation' ? 'title' : 'itemName']: value }))
        }
      />
      <Field
        label="Quantity"
        type="number"
        value={form.quantity}
        onChange={(value) => setForm((f: any) => ({ ...f, quantity: Number(value) }))}
      />
      <Field
        label="Unit Price"
        type="number"
        value={form.unitPrice}
        onChange={(value) => setForm((f: any) => ({ ...f, unitPrice: Number(value) }))}
      />
      <Field
        label="Tax %"
        type="number"
        value={form.taxRate}
        onChange={(value) => setForm((f: any) => ({ ...f, taxRate: Number(value) }))}
      />
      <Field
        label="Discount"
        type="number"
        value={form.discount}
        onChange={(value) => setForm((f: any) => ({ ...f, discount: Number(value) }))}
      />
      <Field
        label={kind === 'quotation' ? 'Valid Until' : 'Due Date'}
        type="date"
        value={kind === 'quotation' ? form.validUntil : form.dueDate}
        onChange={(value) =>
          setForm((f: any) => ({ ...f, [kind === 'quotation' ? 'validUntil' : 'dueDate']: value }))
        }
      />
      {kind === 'invoice' && form.type === 'RECURRING' && (
        <>
          <Field
            label="Billing Period From"
            type="date"
            value={form.billingPeriodFrom}
            onChange={(value) => setForm((f: any) => ({ ...f, billingPeriodFrom: value }))}
          />
          <Field
            label="Billing Period To"
            type="date"
            value={form.billingPeriodTo}
            onChange={(value) => setForm((f: any) => ({ ...f, billingPeriodTo: value }))}
          />
        </>
      )}
    </div>
  );
}

function PaymentForm({
  form,
  setForm,
  invoices,
}: {
  form: any;
  setForm: (fn: any) => void;
  invoices: Invoice[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select
        label="Invoice"
        value={form.invoiceId}
        onChange={(value) =>
          setForm((f: any) => ({
            ...f,
            invoiceId: value,
            amount: invoices.find((i) => i.id === value)?.balanceDue ?? f.amount,
          }))
        }
        options={invoices.map((i) => [i.id, `${i.invoiceNumber} - ${i.client?.companyName}`])}
      />
      <Field
        label="Amount"
        type="number"
        value={form.amount}
        onChange={(value) => setForm((f: any) => ({ ...f, amount: Number(value) }))}
      />
      <Field
        label="Method"
        value={form.paymentMethod}
        onChange={(value) => setForm((f: any) => ({ ...f, paymentMethod: value }))}
      />
      <Field
        label="Reference"
        value={form.referenceNumber}
        onChange={(value) => setForm((f: any) => ({ ...f, referenceNumber: value }))}
      />
      <Field
        label="Payment Date"
        type="date"
        value={form.paymentDate}
        onChange={(value) => setForm((f: any) => ({ ...f, paymentDate: value }))}
      />
    </div>
  );
}

function ExpenseForm({
  form,
  setForm,
  projects,
}: {
  form: any;
  setForm: (fn: any) => void;
  projects: Project[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select
        label="Project"
        value={form.projectId}
        onChange={(value) => setForm((f: any) => ({ ...f, projectId: value }))}
        options={projects.map((p) => [p.id, p.projectName])}
      />
      <Field
        label="Category"
        value={form.category}
        onChange={(value) => setForm((f: any) => ({ ...f, category: value }))}
      />
      <Field
        label="Amount"
        type="number"
        value={form.amount}
        onChange={(value) => setForm((f: any) => ({ ...f, amount: Number(value) }))}
      />
      <Field
        label="Date"
        type="date"
        value={form.expenseDate}
        onChange={(value) => setForm((f: any) => ({ ...f, expenseDate: value }))}
      />
      <div className="sm:col-span-2">
        <Field
          label="Description"
          value={form.description}
          onChange={(value) => setForm((f: any) => ({ ...f, description: value }))}
        />
      </div>
    </div>
  );
}

function RecurringServiceForm({
  form,
  setForm,
  projects,
}: {
  form: any;
  setForm: (fn: any) => void;
  projects: Project[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select
        label="Project Contract"
        value={form.projectId}
        onChange={(value) => setForm((f: any) => ({ ...f, projectId: value }))}
        options={projects.map((p) => [p.id, `${p.projectName} (${p.projectCode})`])}
      />
      <Field
        label="Service Retainer Name"
        value={form.name}
        onChange={(value) => setForm((f: any) => ({ ...f, name: value }))}
      />
      <Field
        label="Billing Rate Amount"
        type="number"
        value={form.amount}
        onChange={(value) => setForm((f: any) => ({ ...f, amount: Number(value) }))}
      />
      <Select
        label="Service Interval"
        value={form.interval}
        onChange={(value) => setForm((f: any) => ({ ...f, interval: value }))}
        options={[
          ['DAILY', 'Daily'],
          ['WEEKLY', 'Weekly'],
          ['MONTHLY', 'Monthly'],
          ['YEARLY', 'Yearly'],
        ]}
      />
      <Field
        label="Start Date"
        type="date"
        value={form.startDate}
        onChange={(value) => setForm((f: any) => ({ ...f, startDate: value }))}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <Input label={label} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-foreground/60">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary"
      >
        <option value="">Select</option>
        {options.map(([id, name]) => (
          <option key={id || name} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
