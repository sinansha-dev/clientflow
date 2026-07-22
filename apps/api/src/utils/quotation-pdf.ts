import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { PassThrough } from 'node:stream';
import { companyConfig } from '../config/company.config';

/* ─────────────────────────────────────────────────────────────────────────────
   generateQuotationPdfToStream
   Produces a professional multi-page A4 commercial proposal PDF to any stream.
───────────────────────────────────────────────────────────────────────────── */
export async function generateQuotationPdfToStream(
  q: any,
  stream: NodeJS.WritableStream,
): Promise<void> {
  // ── Document ───────────────────────────────────────────────────────────────
  const doc = new PDFDocument({
    margin: 0,
    size: 'A4',
    bufferPages: true,
    info: {
      Title: `Quotation – ${q.quoteNumber}`,
      Author: 'ClientFlow',
      Subject: q.title,
      Creator: 'ClientFlow Finance',
      Keywords: 'quotation, proposal, invoice',
    },
  });
  doc.pipe(stream);

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
  const co = companyConfig;

  // ── Billing Plan Draft (JSON field on Quotation) ──────────────────────────
  type StageDraft = { name: string; percentage: number; amount: number; dueDate?: string | null };
  const billing = q.billingPlanDraft as {
    billingType: string;
    stages: StageDraft[];
    monthlyAmount?: number | null;
    retainerStart?: string | null;
    retainerDuration?: number | null;
  } | null;

  const attachments = (q.attachments || []) as { name: string; url: string; type: string }[];

  // ── Helpers ────────────────────────────────────────────────────────────────
  const currency = q.currency || q.client?.currency || 'INR';

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
    ACCEPTED: [C.green, C.greenBg],
    REJECTED: [C.red, C.redBg],
    EXPIRED: [C.gray, C.lightGray],
  };
  const [sFg, sBg] = statusStyle[q.status] ?? [C.gray, C.lightGray];

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

  // ── Right: QUOTATION + meta ────────────────────────────────────────────────
  const col2X = M + CW - 195;

  doc
    .font('Helvetica-Bold')
    .fontSize(26)
    .fillColor(C.primary)
    .text('QUOTATION', col2X, 22, { width: 195, align: 'right' });

  // Status badge
  const bW = 74,
    bH = 16,
    bX = col2X + 195 - bW;
  doc.rect(bX, 54, bW, bH).fill(sBg);
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(sFg)
    .text(q.status, bX, 58, { width: bW, align: 'center', lineBreak: false });

  const creatorName = q.creator
    ? `${q.creator.firstName || ''} ${q.creator.lastName || ''}`.trim()
    : 'Admin';

  const qMeta: [string, string][] = [
    ['Quote No.', q.quoteNumber],
    ['Date', fmtDate(q.quoteDate || q.createdAt)],
    ['Valid Until', fmtDate(q.validUntil)],
    ['Prepared By', creatorName],
    ['Currency', currency],
  ];

  let qMetaY = 75;
  for (const [label, val] of qMeta) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(C.gray)
      .text(`${label}:`, col2X, qMetaY, { width: 72, lineBreak: false });
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(C.navy)
      .text(val, col2X + 74, qMetaY, { width: 121, lineBreak: false });
    qMetaY += 13;
  }

  // Thick accent divider
  const divY = Math.max(leftY, qMetaY) + 6;
  doc.rect(M, divY, CW, 2).fill(C.primary);
  doc.y = divY + 10;

  // ── Project title + description ───────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.navy).text(q.title, M, doc.y, { width: CW });
  doc.y += 4;
  if (q.description) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C.gray)
      .text(q.description, M, doc.y, { width: CW, lineGap: 2 });
    doc.y += 6;
  }
  doc.y += 6;

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 2 — CLIENT INFORMATION
  // ───────────────────────────────────────────────────────────────────────────
  sectionBand('Client Information');

  const halfW = CW / 2 - 10;
  const rColX = M + halfW + 20;
  const clientStartY = doc.y;

  // Left — Prepared For
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(C.gray)
    .text('PREPARED FOR', M, clientStartY, { width: halfW });
  let cL = clientStartY + 14;
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(C.navy)
    .text(q.client?.companyName || '—', M, cL, { width: halfW });
  cL += 16;

  const clientFields: [string, string][] = [
    ['Contact', q.client?.primaryContactName || ''],
    ['Email', q.client?.email || ''],
    ['Phone', q.client?.phone || ''],
    ['Address', q.client?.billingAddress || ''],
    ['GST/Tax', q.client?.taxNumber || ''],
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

  // Right — Project Details
  let cR = clientStartY;
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(C.gray)
    .text('PROJECT DETAILS', rColX, cR, { width: halfW });
  cR += 14;

  const projFields: [string, string][] = [
    ['Project', q.project?.projectName || '(New Project)'],
    ['Ref Code', q.project?.projectCode || '—'],
    ['Quotation', q.quoteNumber],
    ['Quote Date', fmtDate(q.quoteDate || q.createdAt)],
    ['Expires', fmtDate(q.validUntil)],
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

  doc.y = Math.max(cL, cR) + 8;

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 3 — SCOPE OF WORK
  // ───────────────────────────────────────────────────────────────────────────
  if (q.scope) {
    sectionBand('Scope of Work');
    for (const raw of q.scope.split('\n')) {
      ensureSpace(16);
      const line = raw.trim();
      if (!line) {
        doc.y += 3;
        continue;
      }

      if (line.endsWith(':') && line.length < 65 && !line.startsWith('-')) {
        // Sub-heading
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
  // ██  SECTION 4 — QUOTATION ITEMS TABLE
  // ───────────────────────────────────────────────────────────────────────────
  sectionBand('Services & Deliverables');

  const items = (q.items || []) as any[];

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
  // ██  SECTION 5 — COST SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  ensureSpace(100);
  const sumX = M + CW - 238;
  const sumW = 238;

  const summaryRows: [string, string][] = [
    ['Subtotal', fmtMoney(q.subtotal)],
    ['Tax (GST)', fmtMoney(q.tax)],
    ['Discount', q.discount > 0 ? `− ${fmtMoney(q.discount)}` : '—'],
  ];

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(C.primary)
    .text('COST SUMMARY', sumX, doc.y, { width: sumW });
  doc.y += 10;
  hr(sumX, sumW, doc.y, C.border, 0.5);
  doc.y += 6;

  for (const [lbl, val] of summaryRows) {
    const sy = doc.y;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C.gray)
      .text(lbl, sumX, sy, { width: 120, lineBreak: false });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C.text)
      .text(val, sumX + 120, sy, { width: sumW - 120, align: 'right', lineBreak: false });
    doc.y += 14;
  }

  hr(sumX, sumW, doc.y, C.midBorder, 0.8);
  doc.y += 4;

  // Grand Total highlighted row
  ensureSpace(28);
  const gtY = doc.y;
  doc.rect(sumX - 4, gtY, sumW + 4, 26).fill(C.primary);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(C.white)
    .text('GRAND TOTAL', sumX, gtY + 7, { width: 120, lineBreak: false });
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(C.white)
    .text(fmtMoney(q.total), sumX + 120, gtY + 6, {
      width: sumW - 120,
      align: 'right',
      lineBreak: false,
    });
  doc.y = gtY + 34;

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 6 — BILLING PLAN
  // ───────────────────────────────────────────────────────────────────────────
  if (billing) {
    sectionBand('Billing Plan & Payment Schedule');

    const billingLabels: Record<string, string> = {
      FULL_PAYMENT: 'Full Payment',
      ADVANCE_BALANCE: 'Advance + Balance',
      MILESTONE: 'Milestone Billing',
      MONTHLY_RETAINER: 'Monthly Retainer',
      AMC: 'AMC / Recurring',
      CUSTOM: 'Custom',
    };

    // Sub-header: billing type + total
    ensureSpace(28);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C.gray)
      .text('Billing Type: ', M, doc.y, { continued: true, lineBreak: false });
    doc
      .font('Helvetica-Bold')
      .fillColor(C.primary)
      .text(billingLabels[billing.billingType] || billing.billingType);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C.gray)
      .text('Contract Value: ', M, doc.y, { continued: true, lineBreak: false });
    doc.font('Helvetica-Bold').fillColor(C.navy).text(fmtMoney(q.total));
    doc.y += 6;

    // FULL PAYMENT
    if (billing.billingType === 'FULL_PAYMENT') {
      ensureSpace(34);
      const fpY = doc.y;
      doc.rect(M, fpY, CW, 28).fill(C.greenBg);
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor(C.green)
        .text('100% Full Payment — ', M + 10, fpY + 8, { continued: true, lineBreak: false });
      doc
        .font('Helvetica')
        .fillColor(C.green)
        .text(`${fmtMoney(q.total)} due upon project commencement.`);
      doc.y = fpY + 34;

      // STAGED / MILESTONE / CUSTOM
    } else if (
      ['ADVANCE_BALANCE', 'MILESTONE', 'CUSTOM'].includes(billing.billingType) &&
      billing.stages?.length
    ) {
      ensureSpace(26);
      const shY = doc.y;
      doc.rect(M, shY, CW, 20).fill(C.navy);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white);
      doc.text('Stage / Milestone', M + 8, shY + 6, { width: 175, lineBreak: false });
      doc.text('%', M + 185, shY + 6, { width: 50, align: 'right', lineBreak: false });
      doc.text('Amount', M + 235, shY + 6, { width: 110, align: 'right', lineBreak: false });
      doc.text('Due Date', M + 350, shY + 6, { width: 150, lineBreak: false });
      doc.y = shY + 26;

      for (let i = 0; i < billing.stages.length; i++) {
        const s = billing.stages[i];
        if (!s) continue;
        ensureSpace(24);
        const sy = doc.y;
        if (i % 2 === 1) doc.rect(M, sy, CW, 22).fill(C.stripe);

        const stageAmt = s.amount || (q.total * (s.percentage || 0)) / 100;
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(C.navy)
          .text(s.name || `Stage ${i + 1}`, M + 8, sy + 6, { width: 175, lineBreak: false });
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(C.gray)
          .text(fmtPct(s.percentage || 0), M + 185, sy + 6, {
            width: 50,
            align: 'right',
            lineBreak: false,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(C.text)
          .text(fmtMoney(stageAmt), M + 235, sy + 6, {
            width: 110,
            align: 'right',
            lineBreak: false,
          });
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(C.gray)
          .text(s.dueDate ? fmtDate(s.dueDate) : '—', M + 350, sy + 6, {
            width: 150,
            lineBreak: false,
          });

        hr(M, CW, sy + 22, C.border, 0.4);
        doc.y = sy + 24;
      }

      // RETAINER / AMC
    } else if (['MONTHLY_RETAINER', 'AMC'].includes(billing.billingType)) {
      ensureSpace(46);
      const rY = doc.y;
      doc.rect(M, rY, CW, 40).fill(C.primaryBg);
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(C.primary)
        .text(fmtMoney(billing.monthlyAmount || 0), M + 10, rY + 8, {
          continued: true,
          lineBreak: false,
        });
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor(C.gray)
        .text(billing.billingType === 'AMC' ? '  per billing interval' : '  per month');
      if (billing.retainerStart) {
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(C.gray)
          .text(`Start Date: ${fmtDate(billing.retainerStart)}`, M + 10, rY + 26, {
            continued: true,
            lineBreak: false,
          });
      }
      if (billing.retainerDuration) {
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(C.gray)
          .text(`   Duration: ${billing.retainerDuration} months`, { lineBreak: false });
      }
      doc.y = rY + 46;
    }
    doc.y += 6;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 7 — PAYMENT TERMS / NOTES
  // ───────────────────────────────────────────────────────────────────────────
  if (q.notes) {
    sectionBand('Payment Terms & Notes');
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C.text)
      .text(q.notes, M, doc.y, { width: CW, lineGap: 2 });
    doc.y += 8;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ██  SECTION 8 — TERMS & CONDITIONS
  // ───────────────────────────────────────────────────────────────────────────
  sectionBand('Terms & Conditions');

  const tcSource =
    q.termsConditions ||
    [
      'Payment Terms:',
      'Invoices are due within 30 days of issuance unless otherwise agreed.',
      '',
      'Revisions:',
      'Up to 3 rounds of design/development revisions per phase are included. Additional revisions will be billed at standard hourly rates.',
      '',
      'Support Period:',
      '3 months of bug-fix support post-delivery is included at no extra charge.',
      '',
      'Intellectual Property:',
      'Full IP and ownership transfers to the client upon receipt of final payment.',
      '',
      'Cancellation:',
      'Advance payments are non-refundable once work has commenced.',
      '',
      'Confidentiality:',
      'Both parties agree to maintain strict confidentiality of all project information.',
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
  // ██  SECTION 9 — ATTACHMENTS
  // ───────────────────────────────────────────────────────────────────────────
  if (attachments.length > 0) {
    sectionBand('Supporting Documents & Attachments');
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
  // ██  SECTION 10 — APPROVAL & SIGNATURE
  // ───────────────────────────────────────────────────────────────────────────
  ensureSpace(155);
  sectionBand('Client Acceptance & Approval');

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(C.gray)
    .text(
      'By signing below, the client confirms full agreement to the scope, billing plan, and terms & conditions stated in this quotation.',
      M,
      doc.y,
      { width: CW, lineGap: 2 },
    );
  doc.y += 10;

  // Draw a signature box at given x
  const sigBoxW = CW / 2 - 14;
  const drawSigBox = (bx: number, heading: string, sub: string) => {
    const sy = doc.y;
    doc.rect(bx, sy, sigBoxW, 78).strokeColor(C.border).lineWidth(0.8).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(C.navy)
      .text(heading, bx + 8, sy + 8, { width: sigBoxW - 16, lineBreak: false });
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(C.gray)
      .text(sub, bx + 8, sy + 20, { width: sigBoxW - 16, lineBreak: false });

    // Signature field
    hr(bx + 8, sigBoxW - 16, sy + 52, C.midBorder, 0.5);
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(C.gray)
      .text('Signature', bx + 8, sy + 55, { lineBreak: false });

    // Name + Date on one line
    const halfSig = (sigBoxW - 16) / 2;
    hr(bx + 8, halfSig - 4, sy + 70, C.midBorder, 0.5);
    hr(bx + 8 + halfSig, halfSig - 4, sy + 70, C.midBorder, 0.5);
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(C.gray)
      .text('Name', bx + 8, sy + 72, { lineBreak: false });
    doc.text('Date', bx + 8 + halfSig, sy + 72, { lineBreak: false });
  };

  drawSigBox(M, 'Client Authorised Signatory', q.client?.companyName || '');
  drawSigBox(M + sigBoxW + 20, 'Prepared & Authorised By', co.name);
  doc.y += 88;

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(C.gray)
    .text(
      `  Digital Approval: This quotation may also be accepted electronically via the Client Portal — ${co.website}`,
      M,
      doc.y,
      { width: CW },
    );
  doc.y += 16;

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

export async function generateQuotationPdf(q: any, res: Response): Promise<void> {
  return generateQuotationPdfToStream(q, res);
}

export async function generateQuotationPdfBuffer(q: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();
    passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
    passThrough.on('end', () => resolve(Buffer.concat(chunks)));
    passThrough.on('error', (err: Error) => reject(err));
    generateQuotationPdfToStream(q, passThrough).catch(reject);
  });
}
