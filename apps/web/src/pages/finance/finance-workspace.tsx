import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { Check, FileText, Plus, Receipt, RefreshCcw, Send, WalletCards } from 'lucide-react';

type Tab = 'dashboard' | 'quotes' | 'invoices' | 'payments' | 'expenses';
type DocKind = 'quotation' | 'invoice' | 'payment' | 'expense';

const today = new Date().toISOString().slice(0, 10);
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const money = (value = 0, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

export function FinanceWorkspacePage() {
  const notify = useToastStore((state) => state.notify);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
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

  const loadFinance = async () => {
    try {
      setLoading(true);
      const [reportRes, quoteRes, invoiceRes, paymentRes, expenseRes, clientRes, projectRes] =
        await Promise.all([
          api.get('/reports/finance'),
          api.get('/quotations'),
          api.get('/invoices'),
          api.get('/payments'),
          api.get('/expenses'),
          api.get('/clients?limit=1000'),
          api.get('/projects?limit=1000'),
        ]);
      setSummary(reportRes.data.data);
      setQuotations(quoteRes.data.data ?? []);
      setInvoices(invoiceRes.data.data ?? []);
      setPayments(paymentRes.data.data ?? []);
      setExpenses(expenseRes.data.data ?? []);
      setClients(clientRes.data.data?.items ?? []);
      setProjects(projectRes.data.data?.items ?? []);
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

  const action = async (url: string, title: string) => {
    try {
      await api.post(url);
      notify({ type: 'success', title });
      await loadFinance();
    } catch (err) {
      notify({ type: 'error', title: 'Action failed', message: errorMessage(err) });
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-foreground/55">Workspace / Finance</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">Finance</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Quotations, invoices, payments, expenses, and profit snapshots.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void loadFinance()}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => setOpenForm('quotation')}>
            <Plus className="h-4 w-4" /> Quotation
          </Button>
          <Button onClick={() => setOpenForm('invoice')}>
            <Plus className="h-4 w-4" /> Invoice
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
            <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {(['dashboard', 'quotes', 'invoices', 'payments', 'expenses'] as Tab[]).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-3 py-3 text-sm font-bold capitalize ${tab === item ? 'border-b-2 border-primary text-primary' : 'text-foreground/55'}`}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-10 text-center text-sm text-foreground/50">
          Loading finance records...
        </Card>
      ) : null}
      {!loading && tab === 'dashboard' ? (
        <DashboardPanel summary={summary} quotations={quotations} invoices={invoices} />
      ) : null}
      {!loading && tab === 'quotes' ? (
        <QuotationTable
          quotations={quotations}
          onSend={(id) => action(`/quotations/${id}/send`, 'Quotation sent')}
          onApprove={(id) => action(`/quotations/${id}/approve`, 'Quotation approved')}
          onConvert={(id) =>
            action(`/quotations/${id}/convert-invoice`, 'Invoice created from quotation')
          }
        />
      ) : null}
      {!loading && tab === 'invoices' ? (
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
        />
      ) : null}
      {!loading && tab === 'payments' ? <PaymentTable payments={payments} /> : null}
      {!loading && tab === 'expenses' ? (
        <ExpenseTable expenses={expenses} onAdd={() => setOpenForm('expense')} />
      ) : null}

      {openForm === 'quotation' || openForm === 'invoice' ? (
        <Modal
          title={openForm === 'quotation' ? 'New Quotation' : 'New Invoice'}
          onClose={() => setOpenForm(null)}
        >
          <DocumentForm
            form={docForm}
            setForm={setDocForm}
            clients={clients}
            projects={projectOptions}
            kind={openForm}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenForm(null)}>
              Cancel
            </Button>
            <Button onClick={() => createDocument(openForm)}>Save</Button>
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
            <div key={item.id} className="flex justify-between border-b border-border pb-2">
              <span>{item.quoteNumber ?? item.invoiceNumber}</span>
              <span>{money(item.total, item.currency ?? 'USD')}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function QuotationTable({
  quotations,
  onSend,
  onApprove,
  onConvert,
}: {
  quotations: Quotation[];
  onSend: (id: string) => void;
  onApprove: (id: string) => void;
  onConvert: (id: string) => void;
}) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="p-4">Quote</th>
            <th>Client</th>
            <th>Status</th>
            <th>Total</th>
            <th>Valid Until</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {quotations.map((q) => (
            <tr key={q.id} className="border-b border-border">
              <td className="p-4 font-bold">
                {q.quoteNumber}
                <div className="font-normal text-foreground/50">{q.title}</div>
              </td>
              <td>{q.client?.companyName}</td>
              <td>{q.status}</td>
              <td>{money(q.total)}</td>
              <td>{new Date(q.validUntil).toLocaleDateString()}</td>
              <td className="flex gap-2 py-3">
                <Button className="h-8 px-3" variant="secondary" onClick={() => onSend(q.id)}>
                  <Send className="h-4 w-4" />
                </Button>
                <Button className="h-8 px-3" variant="secondary" onClick={() => onApprove(q.id)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button className="h-8 px-3" onClick={() => onConvert(q.id)}>
                  Invoice
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function InvoiceTable({
  invoices,
  onSend,
  onPayment,
}: {
  invoices: Invoice[];
  onSend: (id: string) => void;
  onPayment: (invoice: Invoice) => void;
}) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="p-4">Invoice</th>
            <th>Client</th>
            <th>Status</th>
            <th>Total</th>
            <th>Balance</th>
            <th>Due</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id} className="border-b border-border">
              <td className="p-4 font-bold">{i.invoiceNumber}</td>
              <td>{i.client?.companyName}</td>
              <td>{i.status}</td>
              <td>{money(i.total, i.currency)}</td>
              <td>{money(i.balanceDue, i.currency)}</td>
              <td>{new Date(i.dueDate).toLocaleDateString()}</td>
              <td className="flex gap-2 py-3">
                <Button className="h-8 px-3" variant="secondary" onClick={() => onSend(i.id)}>
                  <Send className="h-4 w-4" />
                </Button>
                <Button className="h-8 px-3" onClick={() => onPayment(i)}>
                  Payment
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PaymentTable({ payments }: { payments: Payment[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="p-4">Invoice</th>
            <th>Client</th>
            <th>Method</th>
            <th>Reference</th>
            <th>Amount</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-border">
              <td className="p-4 font-bold">{p.invoice?.invoiceNumber}</td>
              <td>{p.client?.companyName}</td>
              <td>{p.paymentMethod}</td>
              <td>{p.referenceNumber}</td>
              <td>{money(p.amount, p.invoice?.currency ?? 'USD')}</td>
              <td>{new Date(p.paymentDate).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ExpenseTable({ expenses, onAdd }: { expenses: Expense[]; onAdd: () => void }) {
  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4" /> Expense
        </Button>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-4">Project</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-border">
                <td className="p-4 font-bold">{e.project?.projectName}</td>
                <td>{e.category}</td>
                <td>{e.description}</td>
                <td>{money(e.amount)}</td>
                <td>{new Date(e.expenseDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
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
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-foreground/50">
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
        className="h-10 rounded border border-border bg-background px-3 text-sm text-foreground outline-none"
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
