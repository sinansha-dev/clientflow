import PDFDocument from 'pdfkit';
import type { Response } from 'express';

/* ─────────────────────────────────────────────────────────────────────────────
   generateInvoicePdf
   Produces a professional multi-page A4 invoice proposal/bill PDF.
   Branding is consistent with the quotation proposal layout.
───────────────────────────────────────────────────────────────────────────── */
export async function generateInvoicePdf(inv: any, res: Response): Promise<void> {
  // ── Document ───────────────────────────────────────────────────────────────
  const doc = new PDFDocument({
    margin: 0,
    size: 'A4',
    bufferPages: true,
    info: {
      Title: `Invoice – ${inv.invoiceNumber}`,
      Author: 'ClientFlow',
      Subject: inv.title,
      Creator: 'ClientFlow Finance',
      Keywords: 'invoice, billing, payment',
    },
  });
  doc.pipe(res);

  // ── Design Tokens ──────────────────────────────────────────────────────────
  const C = {
    primary: '#2563eb',
    primaryBg: '#eff6ff',
    navy: '#0f172a',
    text: '#1e293b',
    gray: '#64748b',
    lightGray: '#f8fafc',
    border: '#e2e8f0',
    midBorder: '#cbd5e1',
    white: '#ffffff',
    green: '#16a34a',
    greenBg: '#f0fdf4',
    amber: '#d97706',
    amberBg: '#fffbeb',
    red: '#dc2626',
    redBg: '#fef2f2',
    stripe: '#f1f5f9',
  };

  const M = 45; // margin
  const PW = 595.28; // A4 width pt
  const PH = 841.89; // A4 height pt
  const CW = PW - M * 2; // content width ≈ 505
  const FOOTER_H = 50;
  const SAFE_Y = PH - M - FOOTER_H;

  // ── Company Info (env-configurable) ───────────────────────────────────────
  const co = {
    name: process.env.COMPANY_NAME || 'Your Company',
    address: process.env.COMPANY_ADDRESS || 'Address, City, State',
    phone: process.env.COMPANY_PHONE || '+91 0000000000',
    email: process.env.COMPANY_EMAIL || 'contact@yourcompany.com',
    website: process.env.COMPANY_WEBSITE || 'www.yourcompany.com',
    gst: process.env.COMPANY_GST || '',
  };

  const attachments = (inv.attachments || []) as { name: string; url: string; type: string }[];
  const payments = (inv.payments || []) as any[];

  // ── Helpers ────────────────────────────────────────────────────────────────
  const currency = inv.currency || inv.client?.currency || 'USD';

  const fmtMoney = (val: number) => {
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

  const fmtDate = (d: any): string => {
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

  const fmtPct = (n: number) => `${Number(n || 0).toFixed(0)}%`;

  // Ensure vertical space — add a new page if needed
  const ensureSpace = (pts: number) => {
    if (doc.y + pts > SAFE_Y) doc.addPage();
  };

  // Horizontal rule
  const hr = (x = M, w = CW, y?: number, color = C.border, lw = 0.5) => {
    const yy = y ?? doc.y;
    doc
      .moveTo(x, yy)
      .lineTo(x + w, yy)
      .strokeColor(color)
      .lineWidth(lw)
      .stroke();
  };

  // Blue section heading band
  const sectionBand = (label: string) => {
    ensureSpace(42);
    const y = doc.y + 6;
    doc.rect(M, y, CW, 21).fill(C.primaryBg);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(C.primary)
      .text(label.toUpperCase(), M + 8, y + 7, { width: CW - 16, lineBreak: false });
    doc.y = y + 28;
  };

  // ── Status badge style ─────────────────────────────────────────────────────
  const statusStyle: Record<string, [string, string]> = {
    DRAFT: [C.amber, C.amberBg],
    SENT: [C.primary, C.primaryBg],
    PARTIALLY_PAID: [C.amber, C.amberBg],
    PAID: [C.green, C.greenBg],
    OVERDUE: [C.red, C.redBg],
  };
  const [sFg, sBg] = statusStyle[inv.status] ?? [C.gray, C.lightGray];

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 1 — HEADER
  // ───────────────────────────────────────────────────────────────────────────

  // Top accent stripe
  doc.rect(0, 0, PW, 5).fill(C.primary);

  // ── Left: Company ─────────────────────────────────────────────────────────
  let leftY = 22;
  doc.font('Helvetica-Bold').fontSize(15).fillColor(C.navy).text(co.name, M, leftY, { width: 280 });
  leftY += 20;

  const coLines = [
    co.address,
    `${co.phone}   ·   ${co.email}`,
    co.website,
    co.gst ? `GST: ${co.gst}` : '',
  ].filter(Boolean) as string[];

  doc.font('Helvetica').fontSize(8).fillColor(C.gray);
  for (const line of coLines) {
    doc.text(line, M, leftY, { width: 270, lineBreak: false });
    leftY += 12;
  }

  // ── Right: INVOICE + meta ──────────────────────────────────────────────────
  const col2X = M + CW - 195;

  let docTitle = 'INVOICE';
  if (inv.type === 'RECURRING') docTitle = 'RECURRING INVOICE';
  else if (inv.type === 'ADVANCE') docTitle = 'ADVANCE INVOICE';
  else if (inv.type === 'MILESTONE') docTitle = 'MILESTONE INVOICE';
  else if (inv.type === 'FINAL') docTitle = 'FINAL INVOICE';
  else if (inv.type === 'CREDIT_NOTE') docTitle = 'CREDIT NOTE';

  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(C.primary)
    .text(docTitle, col2X - 50, 22, { width: 245, align: 'right' });

  // Status badge
  const bW = 84,
    bH = 16,
    bX = col2X + 195 - bW;
  doc.rect(bX, 54, bW, bH).fill(sBg);
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(sFg)
    .text(inv.status.replace('_', ' '), bX, 58, { width: bW, align: 'center', lineBreak: false });

  const creatorName = inv.creator
    ? `${inv.creator.firstName || ''} ${inv.creator.lastName || ''}`.trim()
    : 'Admin';

  const iMeta: [string, string][] = [['Invoice No.', inv.invoiceNumber]];

  if (inv.type === 'RECURRING') {
    iMeta.push(['Invoice Type', 'Recurring Service']);
    if (inv.billingPeriodFrom && inv.billingPeriodTo) {
      iMeta.push([
        'Billing Period',
        `${fmtDate(inv.billingPeriodFrom)} – ${fmtDate(inv.billingPeriodTo)}`,
      ]);
    }
  } else if (inv.type && inv.type !== 'PROJECT') {
    const prettyType = inv.type.charAt(0) + inv.type.slice(1).toLowerCase().replace('_', ' ');
    iMeta.push(['Invoice Type', prettyType]);
  }

  iMeta.push(
    ['Issue Date', fmtDate(inv.issueDate)],
    ['Due Date', fmtDate(inv.dueDate)],
    ['Generated By', creatorName],
    ['Currency', currency],
  );

  let iMetaY = 75;
  for (const [label, val] of iMeta) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(C.gray)
      .text(`${label}:`, col2X, iMetaY, { width: 72, lineBreak: false });
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(C.navy)
      .text(val, col2X + 74, iMetaY, { width: 121, lineBreak: false });
    iMetaY += 13;
  }

  // Thick accent divider
  const divY = Math.max(leftY, iMetaY) + 6;
  doc.rect(M, divY, CW, 2).fill(C.primary);
  doc.y = divY + 10;

  // ── Invoice title + project reference ─────────────────────────────────────
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(C.navy)
    .text(inv.title || 'Invoice', M, doc.y, { width: CW });
  doc.y += 4;
  if (inv.notes && !inv.termsConditions) {
    // Show short note here if no main T&C is attached
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C.gray)
      .text(inv.notes, M, doc.y, { width: CW, lineGap: 2 });
    doc.y += 6;
  }
  doc.y += 6;

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 2 — CLIENT INFORMATION (BILL TO)
  // ───────────────────────────────────────────────────────────────────────────
  sectionBand('Billing & Client Information');

  const halfW = CW / 2 - 10;
  const rColX = M + halfW + 20;
  const clientStartY = doc.y;

  // Left — Bill To
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(C.gray)
    .text('BILL TO', M, clientStartY, { width: halfW });
  let cL = clientStartY + 14;
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(C.navy)
    .text(inv.client?.companyName || '—', M, cL, { width: halfW });
  cL += 16;

  const clientFields: [string, string][] = [
    ['Contact', inv.client?.primaryContactName || ''],
    ['Email', inv.client?.email || ''],
    ['Phone', inv.client?.phone || ''],
    ['Address', inv.client?.billingAddress || ''],
    ['GST/Tax', inv.client?.taxNumber || ''],
  ];
  for (const [lbl, val] of clientFields) {
    if (!val) continue;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(C.gray)
      .text(`${lbl}: `, M, cL, { width: 55, lineBreak: false });
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(C.text)
      .text(val, M + 55, cL, { width: halfW - 55 });
    cL += 13;
  }

  // Right — Project Summary Reference
  let cR = clientStartY;
  if (inv.type === 'RECURRING') {
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(C.gray)
      .text('RECURRING CONTRACT DETAILS', rColX, cR, { width: halfW });
    cR += 14;

    const contract = inv.recurringService;
    const projFields: [string, string][] = [
      ['Contract Name', contract?.name || 'Recurring Service Retainer'],
      ['Project', inv.project?.projectName || '—'],
      ['Interval', contract?.interval || '—'],
      ['Billing Rate', contract?.amount ? fmtMoney(contract.amount) : '—'],
      ['Next Renewal', contract?.nextInvoiceDate ? fmtDate(contract.nextInvoiceDate) : '—'],
      ['Status', contract?.status || 'ACTIVE'],
    ];
    for (const [lbl, val] of projFields) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(C.gray)
        .text(`${lbl}: `, rColX, cR, { width: 75, lineBreak: false });
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(C.text)
        .text(val, rColX + 75, cR, { width: halfW - 75 });
      cR += 13;
    }
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(C.gray)
      .text('PROJECT REFERENCE', rColX, cR, { width: halfW });
    cR += 14;

    const projFields: [string, string][] = [
      ['Project', inv.project?.projectName || '(New Project)'],
      ['Code', inv.project?.projectCode || '—'],
      ['Status', inv.project?.status || '—'],
      ['Start Date', inv.project?.startDate ? fmtDate(inv.project.startDate) : '—'],
      ['Deadline', inv.project?.deadline ? fmtDate(inv.project.deadline) : '—'],
    ];
    for (const [lbl, val] of projFields) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(C.gray)
        .text(`${lbl}: `, rColX, cR, { width: 65, lineBreak: false });
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(C.text)
        .text(val, rColX + 65, cR, { width: halfW - 65 });
      cR += 13;
    }
  }

  doc.y = Math.max(cL, cR) + 8;

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 3 — BILLING PLAN SCHEDULE CONTEXT (IF APPLICABLE)
  // ───────────────────────────────────────────────────────────────────────────
  if (inv.billingStage) {
    sectionBand('Billing Plan Integration');
    ensureSpace(38);
    const planY = doc.y;

    const bStage = inv.billingStage;
    const bPlan = bStage.billingPlan;

    const typeLabels: Record<string, string> = {
      FULL_PAYMENT: 'Full Payment',
      ADVANCE_BALANCE: 'Advance + Balance',
      MILESTONE: 'Milestone Billing',
      MONTHLY_RETAINER: 'Monthly Retainer',
      AMC: 'AMC / Recurring',
      CUSTOM: 'Custom',
    };

    doc.rect(M, planY, CW, 30).fill(C.primaryBg);
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(C.primary)
      .text('BILLING PLAN DETAIL', M + 8, planY + 6, { lineBreak: false });

    doc.font('Helvetica').fontSize(8).fillColor(C.navy);
    doc.text(`Project Value: `, M + 8, planY + 18, { continued: true });
    doc.font('Helvetica-Bold').text(fmtMoney(bPlan?.totalAmount || inv.total), { continued: true });
    doc.font('Helvetica').text(`   |   Plan: `, { continued: true });
    doc
      .font('Helvetica-Bold')
      .text(typeLabels[bPlan?.billingType || ''] || 'Milestone', { continued: true });
    doc.font('Helvetica').text(`   |   Current Milestone: `, { continued: true });
    doc.font('Helvetica-Bold').text(bStage.name);

    doc.y = planY + 36;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 4 — SCOPE OF WORK (IF APPLICABLE)
  // ───────────────────────────────────────────────────────────────────────────
  if (inv.scope) {
    sectionBand('Scope of Work');
    for (const raw of inv.scope.split('\n')) {
      ensureSpace(16);
      const line = raw.trim();
      if (!line) {
        doc.y += 3;
        continue;
      }

      if (line.endsWith(':') && line.length < 65 && !line.startsWith('-')) {
        doc.y += 2;
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(C.primary)
          .text(line, M, doc.y, { width: CW });
        doc.y += 1;
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(C.text)
          .text(`  •  ${line.replace(/^[-•]\s*/, '')}`, M, doc.y, { width: CW, lineGap: 1 });
      } else {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(C.text)
          .text(line, M, doc.y, { width: CW, lineGap: 1 });
      }
    }
    doc.y += 8;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 5 — INVOICE ITEMS TABLE
  // ───────────────────────────────────────────────────────────────────────────
  sectionBand('Services & Line Items');

  const items = (inv.items || []) as any[];

  // Column widths (sum = CW ≈ 505)
  const SVC_X = M;
  const SVC_W = 184;
  const QTY_X = M + 184;
  const QTY_W = 34;
  const PRC_X = M + 218;
  const PRC_W = 76;
  const TAX_X = M + 294;
  const TAX_W = 44;
  const DISC_X = M + 338;
  const DISC_W = 50;
  const AMT_X = M + 388;
  const AMT_W = CW - 388; // remaining

  // Table header row
  ensureSpace(26);
  const thY = doc.y;
  doc.rect(M, thY, CW, 20).fill(C.navy);

  const thHeaders: Array<[string, number, number, 'left' | 'right']> = [
    ['Service / Item', SVC_X + 6, SVC_W, 'left'],
    ['Qty', QTY_X, QTY_W, 'right'],
    ['Unit Price', PRC_X, PRC_W, 'right'],
    ['Tax %', TAX_X, TAX_W, 'right'],
    ['Discount', DISC_X, DISC_W, 'right'],
    ['Amount', AMT_X, AMT_W - 6, 'right'],
  ];
  for (const [lbl, x, w, align] of thHeaders) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(C.white)
      .text(lbl, x, thY + 6, { width: w, align, lineBreak: false });
  }
  doc.y = thY + 24;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nameLines = Math.ceil(
      doc.heightOfString(item.name || '', { width: SVC_W - 12 }) / doc.currentLineHeight(),
    );
    const descLines = item.description
      ? Math.ceil(
          doc.heightOfString(item.description, { width: SVC_W - 12 }) / doc.currentLineHeight(),
        )
      : 0;
    const rowH = Math.max((nameLines + descLines) * 12 + 16, 28);

    ensureSpace(rowH + 2);
    const ry = doc.y;

    if (i % 2 === 1) doc.rect(M, ry, CW, rowH).fill(C.stripe);

    // Service name + description
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(C.navy)
      .text(item.name || '', SVC_X + 6, ry + 8, { width: SVC_W - 12, lineBreak: true });
    if (item.description) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(C.gray)
        .text(item.description, SVC_X + 6, ry + 8 + nameLines * 12, { width: SVC_W - 12 });
    }

    // Numeric cells (vertically centred)
    const midY = ry + rowH / 2 - 5;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C.text)
      .text(String(item.quantity || 1), QTY_X, midY, {
        width: QTY_W,
        align: 'right',
        lineBreak: false,
      })
      .text(fmtMoney(item.unitPrice), PRC_X, midY, {
        width: PRC_W,
        align: 'right',
        lineBreak: false,
      })
      .text(`${item.taxRate || 0}%`, TAX_X, midY, {
        width: TAX_W,
        align: 'right',
        lineBreak: false,
      })
      .text('—', DISC_X, midY, { width: DISC_W, align: 'right', lineBreak: false });

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(C.navy)
      .text(fmtMoney(item.total), AMT_X, midY, {
        width: AMT_W - 6,
        align: 'right',
        lineBreak: false,
      });

    hr(M, CW, ry + rowH, C.border, 0.4);
    doc.y = ry + rowH + 2;
  }
  doc.y += 8;

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 6 — COST SUMMARY (OUTSTANDING BALANCE)
  // ───────────────────────────────────────────────────────────────────────────
  ensureSpace(120);
  const sumX = M + CW - 238;
  const sumW = 238;

  const summaryRows: [string, string][] = [
    ['Subtotal', fmtMoney(inv.subtotal)],
    ['Tax (GST)', fmtMoney(inv.tax)],
    ['Discount', inv.discount > 0 ? `− ${fmtMoney(inv.discount)}` : '—'],
    ['Grand Total', fmtMoney(inv.total)],
    ['Amount Paid', fmtMoney(inv.amountPaid)],
  ];

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(C.primary)
    .text('FINANCIAL SUMMARY', sumX, doc.y, { width: sumW });
  doc.y += 10;
  hr(sumX, sumW, doc.y, C.border, 0.5);
  doc.y += 6;

  for (const [lbl, val] of summaryRows) {
    const sy = doc.y;
    const isGt = lbl === 'Grand Total';
    doc
      .font(isGt ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor(isGt ? C.navy : C.gray)
      .text(lbl, sumX, sy, { width: 120, lineBreak: false });
    doc
      .font(isGt ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor(isGt ? C.navy : C.text)
      .text(val, sumX + 120, sy, { width: sumW - 120, align: 'right', lineBreak: false });
    doc.y += 14;
  }

  hr(sumX, sumW, doc.y, C.midBorder, 0.8);
  doc.y += 4;

  // Outstanding Balance highlighted row
  ensureSpace(28);
  const balY = doc.y;
  const isOverdue = new Date(inv.dueDate) < new Date() && inv.balanceDue > 0;
  const outstandingBg = isOverdue ? C.redBg : C.greenBg;
  const outstandingFg = isOverdue ? C.red : C.green;

  doc.rect(sumX - 4, balY, sumW + 4, 26).fill(outstandingBg);
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(outstandingFg)
    .text('BALANCE DUE', sumX, balY + 7, { width: 120, lineBreak: false });
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(outstandingFg)
    .text(fmtMoney(inv.balanceDue), sumX + 120, balY + 6, {
      width: sumW - 120,
      align: 'right',
      lineBreak: false,
    });
  doc.y = balY + 34;

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 7 — PAYMENT HISTORY (IF PARTIAL PAYMENTS RECORDED)
  // ───────────────────────────────────────────────────────────────────────────
  if (payments.length > 0) {
    sectionBand('Transaction History / Payments Received');
    ensureSpace(24);
    const py = doc.y;
    doc.rect(M, py, CW, 18).fill(C.navy);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white);
    doc.text('Payment Date', M + 8, py + 5, { width: 110, lineBreak: false });
    doc.text('Method', M + 120, py + 5, { width: 110, lineBreak: false });
    doc.text('Reference No.', M + 230, py + 5, { width: 140, lineBreak: false });
    doc.text('Amount Received', M + 370, py + 5, { width: 130, align: 'right', lineBreak: false });
    doc.y = py + 22;

    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      if (!p) continue;
      ensureSpace(22);
      const rowY = doc.y;
      if (i % 2 === 1) doc.rect(M, rowY, CW, 20).fill(C.stripe);

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(C.text)
        .text(fmtDate(p.paymentDate), M + 8, rowY + 5, { width: 110, lineBreak: false });
      doc.text(p.paymentMethod || '—', M + 120, rowY + 5, { width: 110, lineBreak: false });
      doc.text(p.referenceNumber || '—', M + 230, rowY + 5, { width: 140, lineBreak: false });
      doc
        .font('Helvetica-Bold')
        .fillColor(C.green)
        .text(fmtMoney(p.amount), M + 370, rowY + 5, {
          width: 130,
          align: 'right',
          lineBreak: false,
        });

      hr(M, CW, rowY + 20, C.border, 0.4);
      doc.y = rowY + 22;
    }
    doc.y += 8;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 8 — PAYMENT INSTRUCTIONS
  // ───────────────────────────────────────────────────────────────────────────
  if (inv.paymentMethod || inv.paymentInstructions) {
    sectionBand('Payment Instructions');
    if (inv.paymentMethod) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(C.navy)
        .text('Preferred Payment Method: ', M, doc.y, { continued: true, lineBreak: false });
      doc.font('Helvetica').fillColor(C.primary).text(inv.paymentMethod);
      doc.y += 6;
    }
    if (inv.paymentInstructions) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(C.text)
        .text(inv.paymentInstructions, M, doc.y, { width: CW, lineGap: 2 });
      doc.y += 8;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 9 — TERMS & CONDITIONS
  // ───────────────────────────────────────────────────────────────────────────
  sectionBand('Terms & Conditions');

  const tcSource =
    inv.termsConditions ||
    [
      'Due Date Policy:',
      'Payments must be completed within 30 days of the invoice issue date. A late fee of 1.5% per month will be charged on overdue amounts.',
      '',
      'Tax Structure:',
      'All prices listed are net of taxes. Standard local GST/taxes are calculated and applied to the line items.',
      '',
      'Intellectual Property Transfer:',
      'Full ownership, codes, and copyright parameters will transfer only upon receipt of full and final payment clearance.',
      '',
      'Cancellation & Refunds:',
      'Invoiced amounts are non-refundable once the milestone is signed off and billed.',
    ].join('\n');

  for (const raw of tcSource.split('\n')) {
    ensureSpace(16);
    const line = raw.trim();
    if (!line) {
      doc.y += 3;
      continue;
    }

    if (line.endsWith(':') && line.length < 60 && !line.startsWith('-')) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy).text(line, M, doc.y, { width: CW });
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(C.text)
        .text(`  •  ${line.replace(/^[-•]\s*/, '')}`, M, doc.y, { width: CW, lineGap: 1 });
    } else {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(C.text)
        .text(line, M, doc.y, { width: CW, lineGap: 1 });
    }
  }
  doc.y += 8;

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 10 — ATTACHMENTS
  // ───────────────────────────────────────────────────────────────────────────
  if (attachments.length > 0) {
    sectionBand('Reference Attachments');
    for (const att of attachments) {
      ensureSpace(20);
      const ay = doc.y;
      doc.rect(M, ay, CW, 18).fill(C.lightGray);
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(C.navy)
        .text(`[${att.type}]  ${att.name}`, M + 8, ay + 4, { width: 280, lineBreak: false });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(C.primary)
        .text(att.url, M + 296, ay + 4, { width: CW - 304, lineBreak: false });
      doc.y = ay + 22;
    }
    doc.y += 4;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ██  FOOTER — drawn on every page via bufferPages
  // ───────────────────────────────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    const fY = PH - M - 34;

    // Accent line above footer
    doc.rect(0, fY - 2, PW, 2).fill(C.primary);

    // Left: company + contact
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(C.gray)
      .text(`${co.name}   ·   ${co.website}   ·   ${co.email}`, M, fY + 6, {
        width: CW - 50,
        lineBreak: false,
      });

    // Centre: "Generated by ClientFlow"
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(C.midBorder)
      .text('Generated by ClientFlow', M, fY + 18, {
        width: CW,
        align: 'center',
        lineBreak: false,
      });

    // Right: page number
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(C.primary)
      .text(`Page ${i + 1} of ${totalPages}`, M + CW - 64, fY + 6, {
        width: 64,
        align: 'right',
        lineBreak: false,
      });
  }

  doc.end();
}
