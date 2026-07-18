import { useEffect, useState } from 'react';
import { ArrowLeft, ZoomIn, ZoomOut, Printer, Download, Mail, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { useToastStore } from '../../stores/toast-store';

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'INVOICE' | 'QUOTATION';
  data: {
    id?: string | undefined;
    title: string;
    number: string;
    issueDate: string;
    dueDate?: string | undefined;
    validUntil?: string | undefined;
    currency: string;
    status: string;
    client?: any;
    project?: any;
    items: any[];
    globalDiscount: number;
    notes?: string | undefined;
    scope?: string | undefined;
    termsConditions?: string | undefined;
    paymentMethod?: string | undefined;
    paymentInstructions?: string | undefined;
    billingType?: string | undefined;
    billingStages?: any[] | undefined;
    monthlyAmount?: number | undefined;
    retainerStart?: string | undefined;
    retainerDuration?: number | undefined;
    billingStage?: any;
    recurringService?: any;
    type?: string | undefined;
    billingPeriodFrom?: string | undefined;
    billingPeriodTo?: string | undefined;
    billingBreakdown?: any[] | undefined;
  };
}

export function DocumentPreview({ isOpen, onClose, documentType, data }: DocumentPreviewProps) {
  const notify = useToastStore((s) => s.notify);
  const [zoom, setZoom] = useState(1);
  const [co, setCo] = useState({
    name: 'Your Company',
    address: 'Address, City, State',
    phone: '+91 0000000000',
    email: 'contact@yourcompany.com',
    website: 'www.yourcompany.com',
    gst: '',
  });

  const loadCompanyDetails = async () => {
    try {
      const res = await api.get('/invoices/company-details');
      if (res.data.success && res.data.data) {
        setCo(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load company details:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadCompanyDetails();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Formatting helpers
  const currency = data.currency || data.client?.currency || 'USD';
  const money = (val: number) => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(val || 0);
    } catch {
      return `${currency} ${(val || 0).toFixed(2)}`;
    }
  };

  const fmtDate = (d: any) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return String(d);
    }
  };

  const totals = data.items.reduce(
    (acc, item) => {
      const base = item.quantity * item.unitPrice;
      const afterDiscount = base - (item.discount || 0);
      const tax = afterDiscount * ((item.taxRate || 0) / 100);
      acc.subtotal += base;
      acc.tax += tax;
      acc.itemDiscounts += item.discount || 0;
      return acc;
    },
    { subtotal: 0, tax: 0, itemDiscounts: 0 },
  );

  const totalAmount = Math.max(
    totals.subtotal + totals.tax - totals.itemDiscounts - (data.globalDiscount || 0),
    0,
  );
  const amountPaid = (data as any).amountPaid || 0;
  const balanceDue = Math.max(totalAmount - amountPaid, 0);

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    SENT: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    PAID: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
    PARTIALLY_PAID: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20',
    OVERDUE: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
    ACCEPTED: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!data.id) {
      notify({
        type: 'info',
        title: 'Draft Document',
        message: 'Please save the draft first to download the official PDF.',
      });
      return;
    }
    const path =
      documentType === 'INVOICE' ? `/invoices/${data.id}/pdf` : `/quotations/${data.id}/pdf`;
    window.open(`${api.defaults.baseURL}${path}`, '_blank');
  };

  const handleSendEmail = async () => {
    if (!data.id) {
      notify({
        type: 'info',
        title: 'Draft Document',
        message: 'Please save the draft first to email the document.',
      });
      return;
    }
    try {
      const path =
        documentType === 'INVOICE' ? `/invoices/${data.id}/send` : `/quotations/${data.id}/send`;
      await api.post(path);
      notify({
        type: 'success',
        title: 'Success',
        message: `${documentType === 'INVOICE' ? 'Invoice' : 'Quotation'} email sent successfully!`,
      });
    } catch (err) {
      notify({
        type: 'error',
        title: 'Failed',
        message: 'Failed to send document email.',
      });
    }
  };

  // Determine doc title & type details
  let docTitle = documentType === 'INVOICE' ? 'INVOICE' : 'QUOTATION';
  if (documentType === 'INVOICE') {
    if (data.type === 'RECURRING') docTitle = 'RECURRING INVOICE';
    else if (data.type === 'ADVANCE') docTitle = 'ADVANCE INVOICE';
    else if (data.type === 'MILESTONE') docTitle = 'MILESTONE INVOICE';
    else if (data.type === 'FINAL') docTitle = 'FINAL INVOICE';
    else if (data.type === 'CREDIT_NOTE') docTitle = 'CREDIT NOTE';
  }

  const isOverdue =
    documentType === 'INVOICE' &&
    data.dueDate &&
    new Date(data.dueDate) < new Date() &&
    balanceDue > 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col font-sans no-print select-none animate-fade-in">
      {/* ── Dynamic print style insertion ── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #document-print-target, #document-print-target * {
            visibility: visible !important;
          }
          #document-print-target {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 20mm !important;
            box-shadow: none !important;
            transform: none !important;
            zoom: 1 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-white h-9 px-3 border border-slate-800 hover:bg-slate-800 gap-1.5 font-bold"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Editor
          </Button>
          <div className="h-4 w-px bg-slate-800" />
          <span className="text-sm font-bold text-slate-300">
            Previewing: <span className="text-white">{data.number || 'Draft'}</span>
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono w-12 text-center text-slate-400 font-bold">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.1))}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="h-4 w-px bg-slate-800 mx-1" />
          <Button
            variant="ghost"
            onClick={() => setZoom(1.0)}
            className="h-8 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 font-bold"
          >
            Fit Page
          </Button>
          <Button
            variant="ghost"
            onClick={() => setZoom(1.3)}
            className="h-8 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 font-bold"
          >
            Fit Width
          </Button>
        </div>

        {/* Document Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handlePrint}
            className="h-9 px-3 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white gap-1.5 font-bold"
          >
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button
            variant="ghost"
            onClick={handleDownload}
            className="h-9 px-3 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white gap-1.5 font-bold"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button
            variant="ghost"
            onClick={handleSendEmail}
            className="h-9 px-3 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white gap-1.5 font-bold"
          >
            <Mail className="h-4 w-4" /> Send Email
          </Button>
          <Button
            variant="ghost"
            onClick={loadCompanyDetails}
            className="h-9 w-9 p-0 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Refresh Profile"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Scroll Area for Sheet ── */}
      <div className="flex-1 overflow-auto bg-slate-950 p-8 flex justify-center items-start select-text">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          className="transition-transform duration-100 ease-out origin-top mb-16"
        >
          {/* ── A4 Page Sheet ── */}
          <div
            id="document-print-target"
            className="w-[210mm] min-height-[297mm] bg-white text-slate-800 p-[20mm] box-border relative shadow-2xl flex flex-col font-sans"
            style={{ minHeight: '297mm' }}
          >
            {/* Top Accent Color Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600 no-print" />

            {/* Section 1: Header Info */}
            <div className="flex justify-between items-start mb-6">
              {/* Left Column: Company */}
              <div className="max-w-[320px]">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                  {co.name}
                </h2>
                <div className="text-[10px] text-slate-500 mt-2.5 space-y-1 leading-normal font-medium">
                  <p>{co.address}</p>
                  <p>
                    {co.phone} &nbsp;·&nbsp; {co.email}
                  </p>
                  <p>{co.website}</p>
                  {co.gst && (
                    <p className="font-semibold text-slate-600 mt-1">GST / Tax ID: {co.gst}</p>
                  )}
                </div>
              </div>

              {/* Right Column: Title & Metadata */}
              <div className="text-right flex flex-col items-end">
                <h1 className="text-2xl font-black text-blue-600 tracking-tight leading-none uppercase">
                  {docTitle}
                </h1>

                {/* Status Badge */}
                <span
                  className={`mt-3 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${statusColors[data.status] || 'bg-slate-100 text-slate-600'}`}
                >
                  {data.status.replace('_', ' ')}
                </span>

                <table className="mt-4 text-left text-[10px] leading-normal font-medium text-slate-500">
                  <tbody>
                    <tr>
                      <td className="pr-4 py-0.5">
                        {documentType === 'INVOICE' ? 'Invoice No.' : 'Quote No.'}
                      </td>
                      <td className="font-bold text-slate-950 py-0.5">
                        {data.number || 'Auto-generated'}
                      </td>
                    </tr>
                    {documentType === 'INVOICE' && data.type === 'RECURRING' && (
                      <>
                        <tr>
                          <td className="pr-4 py-0.5">Billing Type</td>
                          <td className="font-bold text-slate-950 py-0.5">Recurring Service</td>
                        </tr>
                        {data.billingPeriodFrom && data.billingPeriodTo && (
                          <tr>
                            <td className="pr-4 py-0.5">Billing Period</td>
                            <td className="font-bold text-slate-950 py-0.5">
                              {fmtDate(data.billingPeriodFrom)} – {fmtDate(data.billingPeriodTo)}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                    {documentType === 'INVOICE' &&
                      data.type &&
                      data.type !== 'PROJECT' &&
                      data.type !== 'RECURRING' && (
                        <tr>
                          <td className="pr-4 py-0.5">Invoice Type</td>
                          <td className="font-bold text-slate-950 py-0.5 capitalize">
                            {data.type.toLowerCase().replace('_', ' ')}
                          </td>
                        </tr>
                      )}
                    <tr>
                      <td className="pr-4 py-0.5">Issue Date</td>
                      <td className="font-bold text-slate-950 py-0.5">{fmtDate(data.issueDate)}</td>
                    </tr>
                    {documentType === 'INVOICE' ? (
                      <tr>
                        <td className="pr-4 py-0.5">Due Date</td>
                        <td className="font-bold text-slate-950 py-0.5">{fmtDate(data.dueDate)}</td>
                      </tr>
                    ) : (
                      <tr>
                        <td className="pr-4 py-0.5">Valid Until</td>
                        <td className="font-bold text-slate-950 py-0.5">
                          {fmtDate(data.validUntil)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="pr-4 py-0.5">Currency</td>
                      <td className="font-bold text-slate-950 py-0.5 uppercase">{currency}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Accent divider line */}
            <div className="h-[2px] bg-blue-600 mb-4" />

            {/* Document Title */}
            <h2 className="text-base font-bold text-slate-950 mb-3">
              {data.title ||
                (documentType === 'INVOICE' ? 'Invoice Summary' : 'Quotation Proposal')}
            </h2>

            {/* Section 2: Bill To & Project Info */}
            <div className="bg-blue-600/5 text-blue-600 px-3 py-1.5 font-bold text-[9px] tracking-wider uppercase mb-3 rounded-xs">
              Billing & Client Information
            </div>

            <div className="grid grid-cols-2 gap-8 text-[10px] mb-6">
              {/* Left Column: Bill To */}
              <div>
                <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-widest mb-1.5">
                  Bill To
                </span>
                <span className="block font-bold text-slate-900 text-xs mb-1">
                  {data.client?.companyName || '—'}
                </span>
                <div className="space-y-0.5 text-slate-500 font-medium leading-relaxed">
                  {data.client?.primaryContactName && (
                    <p>
                      Contact:{' '}
                      <span className="font-bold text-slate-700">
                        {data.client.primaryContactName}
                      </span>
                    </p>
                  )}
                  {data.client?.email && (
                    <p>
                      Email: <span className="font-bold text-slate-700">{data.client.email}</span>
                    </p>
                  )}
                  {data.client?.phone && (
                    <p>
                      Phone: <span className="font-bold text-slate-700">{data.client.phone}</span>
                    </p>
                  )}
                  {data.client?.billingAddress && (
                    <p>
                      Address:{' '}
                      <span className="font-bold text-slate-700">{data.client.billingAddress}</span>
                    </p>
                  )}
                  {data.client?.taxNumber && (
                    <p className="mt-1">
                      Tax/GST No:{' '}
                      <span className="font-bold text-slate-700">{data.client.taxNumber}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Project or Subscription */}
              <div>
                {documentType === 'INVOICE' && data.type === 'RECURRING' ? (
                  <>
                    <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-widest mb-1.5">
                      Recurring Contract Details
                    </span>
                    <div className="space-y-0.5 text-slate-500 font-medium leading-relaxed">
                      <p>
                        Contract Name:{' '}
                        <span className="font-bold text-slate-800">
                          {data.recurringService?.name || 'AMC Retainer'}
                        </span>
                      </p>
                      <p>
                        Project Scope:{' '}
                        <span className="font-bold text-slate-800">
                          {data.project?.projectName || '—'}
                        </span>
                      </p>
                      <p>
                        Billing Cycle:{' '}
                        <span className="font-bold text-slate-800">
                          {data.recurringService?.interval || '—'}
                        </span>
                      </p>
                      <p>
                        Rate:{' '}
                        <span className="font-bold text-slate-800">
                          {money(data.recurringService?.amount || 0)}
                        </span>
                      </p>
                      {data.recurringService?.nextInvoiceDate && (
                        <p>
                          Next Renewal:{' '}
                          <span className="font-bold text-slate-800">
                            {fmtDate(data.recurringService.nextInvoiceDate)}
                          </span>
                        </p>
                      )}
                      <p>
                        Status:{' '}
                        <span className="font-bold text-emerald-600">
                          {data.recurringService?.status || 'ACTIVE'}
                        </span>
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-widest mb-1.5">
                      Project Reference
                    </span>
                    <div className="space-y-0.5 text-slate-500 font-medium leading-relaxed">
                      <p>
                        Project Name:{' '}
                        <span className="font-bold text-slate-800">
                          {data.project?.projectName || '(New Project)'}
                        </span>
                      </p>
                      <p>
                        Project Code:{' '}
                        <span className="font-bold text-slate-800">
                          {data.project?.projectCode || '—'}
                        </span>
                      </p>
                      <p>
                        Status:{' '}
                        <span className="font-bold text-slate-800">
                          {data.project?.status || '—'}
                        </span>
                      </p>
                      {data.project?.startDate && (
                        <p>
                          Start Date:{' '}
                          <span className="font-bold text-slate-800">
                            {fmtDate(data.project.startDate)}
                          </span>
                        </p>
                      )}
                      {data.project?.deadline && (
                        <p>
                          Deadline:{' '}
                          <span className="font-bold text-slate-800">
                            {fmtDate(data.project.deadline)}
                          </span>
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Section 3: Billing Plan Integration / Breakdown */}
            {documentType === 'INVOICE' && data.billingStage && (
              <div className="mb-6">
                <div className="bg-blue-600/5 text-blue-600 px-3 py-1.5 font-bold text-[9px] tracking-wider uppercase mb-1.5 rounded-xs">
                  Billing Plan Integration
                </div>
                <div className="bg-blue-50/50 border border-blue-100 rounded-sm p-3 text-[10px] leading-relaxed text-slate-700">
                  <div className="grid grid-cols-3 gap-2">
                    <p>
                      Plan Type:{' '}
                      <span className="font-bold text-slate-900 capitalize">
                        {data.billingStage?.billingPlan?.billingType
                          ?.toLowerCase()
                          .replace('_', ' ') || 'Milestone'}
                      </span>
                    </p>
                    <p>
                      Total Contract Value:{' '}
                      <span className="font-bold text-slate-900">
                        {money(data.billingStage?.billingPlan?.totalAmount || 0)}
                      </span>
                    </p>
                    <p>
                      Current Milestone:{' '}
                      <span className="font-bold text-blue-600">{data.billingStage?.name}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {documentType === 'QUOTATION' &&
              (data as any).billingBreakdown &&
              (data as any).billingBreakdown.length > 0 && (
                <div className="mb-6">
                  <div className="bg-blue-600/5 text-blue-600 px-3 py-1.5 font-bold text-[9px] tracking-wider uppercase mb-2 rounded-xs">
                    Proposed Billing Schedule
                  </div>
                  <div className="border border-slate-200 rounded-sm overflow-hidden text-[10px]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-900 text-white font-bold">
                          <th className="px-3 py-1.5">Milestone / Billing Stage</th>
                          <th className="px-3 py-1.5 text-right w-32">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data as any).billingBreakdown.map((stage: any, idx: number) => (
                          <tr
                            key={idx}
                            className={`border-b border-slate-100 font-medium ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}
                          >
                            <td className="px-3 py-2 text-slate-900">{stage.name}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900">
                              {money(stage.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {/* Section 4: Scope of Work */}
            {data.scope && (
              <div className="mb-6">
                <div className="bg-blue-600/5 text-blue-600 px-3 py-1.5 font-bold text-[9px] tracking-wider uppercase mb-2 rounded-xs">
                  Scope of Work
                </div>
                <div className="space-y-1.5 text-[10px] leading-relaxed text-slate-600">
                  {data.scope.split('\n').map((line, idx) => {
                    const cleanLine = line.trim();
                    if (!cleanLine) return <div key={idx} className="h-1" />;
                    if (
                      cleanLine.endsWith(':') &&
                      cleanLine.length < 65 &&
                      !cleanLine.startsWith('-')
                    ) {
                      return (
                        <p key={idx} className="font-bold text-blue-600 mt-2">
                          {cleanLine}
                        </p>
                      );
                    }
                    if (cleanLine.startsWith('- ') || cleanLine.startsWith('• ')) {
                      return (
                        <p key={idx} className="pl-3 font-medium">
                          · {cleanLine.replace(/^[-•]\s*/, '')}
                        </p>
                      );
                    }
                    return (
                      <p key={idx} className="font-medium">
                        {cleanLine}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 5: Items Table */}
            <div className="flex-1">
              <div className="bg-blue-600/5 text-blue-600 px-3 py-1.5 font-bold text-[9px] tracking-wider uppercase mb-2.5 rounded-xs">
                Services & Line Items
              </div>
              <div className="border border-slate-200 rounded-sm overflow-hidden text-[10px] mb-6">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold">
                      <th className="px-3 py-2 text-left">Service / Item</th>
                      <th className="px-2 py-2 text-right w-12">Qty</th>
                      <th className="px-2 py-2 text-right w-24">Unit Price</th>
                      <th className="px-2 py-2 text-right w-16">Tax %</th>
                      <th className="px-2 py-2 text-right w-20">Discount</th>
                      <th className="px-3 py-2 text-right w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                          No items logged.
                        </td>
                      </tr>
                    ) : (
                      data.items.map((item, idx) => {
                        const itemAmt = item.quantity * item.unitPrice - (item.discount || 0);
                        const afterTax = itemAmt + itemAmt * ((item.taxRate || 0) / 100);
                        return (
                          <tr
                            key={idx}
                            className={`border-b border-slate-100 font-medium ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}
                          >
                            <td className="px-3 py-2.5">
                              <p className="font-bold text-slate-900">
                                {item.name || 'Professional service'}
                              </p>
                              {item.description && (
                                <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">
                                  {item.description}
                                </p>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-right text-slate-600">
                              {item.quantity}
                            </td>
                            <td className="px-2 py-2.5 text-right text-slate-600">
                              {money(item.unitPrice)}
                            </td>
                            <td className="px-2 py-2.5 text-right text-slate-600">
                              {item.taxRate || 0}%
                            </td>
                            <td className="px-2 py-2.5 text-right text-slate-600">
                              {item.discount > 0 ? money(item.discount) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                              {money(afterTax)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Visual Page Break line in Preview if content looks long */}
            {data.items.length > 3 && (
              <div className="w-full border-t border-dashed border-red-300 my-6 py-1 relative no-print">
                <span className="absolute right-0 -top-2 bg-white px-2 text-[8px] text-red-400 font-black tracking-widest uppercase">
                  Page Break (Print boundary)
                </span>
              </div>
            )}

            {/* Section 6: Financial Summary */}
            <div className="grid grid-cols-12 gap-4 mt-4">
              {/* Payment Details */}
              <div className="col-span-7 text-[10px] space-y-3 pr-4">
                {documentType === 'INVOICE' && data.paymentInstructions && (
                  <div>
                    <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-widest mb-1.5">
                      Payment Details ({data.paymentMethod || 'Transfer'})
                    </span>
                    <div className="bg-slate-50 border border-slate-200/60 rounded-sm p-3 font-mono text-[9px] text-slate-600 whitespace-pre-line leading-relaxed">
                      {data.paymentInstructions}
                    </div>
                  </div>
                )}
              </div>

              {/* Cost Summary Box */}
              <div className="col-span-5 text-[10px]">
                <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-widest mb-2">
                  Financial Summary
                </span>
                <table className="w-full text-slate-500 leading-normal font-medium border-t border-slate-100 pt-2">
                  <tbody>
                    <tr>
                      <td className="py-1">Subtotal</td>
                      <td className="text-right text-slate-950 py-1">{money(totals.subtotal)}</td>
                    </tr>
                    <tr>
                      <td className="py-1">Tax (GST)</td>
                      <td className="text-right text-slate-950 py-1">{money(totals.tax)}</td>
                    </tr>
                    <tr>
                      <td className="py-1">Discount</td>
                      <td className="text-right text-slate-950 py-1">
                        {data.globalDiscount > 0 ? `− ${money(data.globalDiscount)}` : '—'}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 text-slate-900 font-bold text-xs">
                      <td className="py-1.5">Grand Total</td>
                      <td className="text-right text-blue-600 py-1.5">{money(totalAmount)}</td>
                    </tr>
                    {documentType === 'INVOICE' && (
                      <>
                        <tr className="text-slate-500 font-medium">
                          <td className="py-1">Amount Paid</td>
                          <td className="text-right text-slate-800 py-1">{money(amountPaid)}</td>
                        </tr>
                        {/* Balance due highlighter row */}
                        <tr className="text-xs font-bold">
                          <td colSpan={2} className="pt-2">
                            <div
                              className={`p-2 rounded-sm text-center tracking-wide ${isOverdue ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}
                            >
                              Balance Due: &nbsp;{money(balanceDue)}
                              {isOverdue && (
                                <span className="block text-[8px] font-black uppercase mt-0.5 tracking-widest text-rose-500">
                                  Overdue
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 7: Notes & Terms */}
            {(data.notes || data.termsConditions) && (
              <div className="mt-8 border-t border-slate-100 pt-4 text-[9px] text-slate-400 leading-relaxed font-medium space-y-2">
                {data.notes && (
                  <div>
                    <span className="font-bold text-slate-700 uppercase tracking-wider block mb-0.5">
                      Notes:
                    </span>
                    <p className="text-slate-500">{data.notes}</p>
                  </div>
                )}
                {data.termsConditions && (
                  <div>
                    <span className="font-bold text-slate-700 uppercase tracking-wider block mb-0.5">
                      Terms & Conditions:
                    </span>
                    <p className="text-slate-500 whitespace-pre-line">{data.termsConditions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Section 8: Footer */}
            <div className="mt-auto border-t border-slate-100 pt-3 flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider">
              <span>{co.name}</span>
              <span>Page 1 of 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
