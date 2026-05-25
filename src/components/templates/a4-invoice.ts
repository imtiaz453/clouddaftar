import type { RenderData, RenderOptions } from "@/lib/template-registry";
import { docLabel } from "@/lib/document-labels";
import {
  esc,
  fmt,
  fd,
  companyInfo,
  customerInfo,
  operationalInfo,
  itemsTable,
  itemsHeader,
  totalsBlock,
  notesBlock,
  termsBlock,
  signatureBlock,
  barcodeBlock,
  qrBlock,
  complianceBadge,
  paymentStatusBadge,
  statusWatermark,
  wrapHtml,
} from "./shared";

function a4Wrapper(content: string, styles: string, opts: RenderOptions): string {
  return wrapHtml(content, styles, opts);
}

export function renderModernMinimal(data: RenderData, opts: RenderOptions): string {
  const pc = opts.primaryColor;
  const ac = opts.accentColor;
  const d = data.document;
  const content = `
    ${statusWatermark(d.status)}
    <div class="top-strip" style="background:${ac};height:4px;margin:-15mm -15mm 20px;"></div>
    <div class="header">
      <div class="header-left">
        ${companyInfo(data, opts)}
      </div>
      <div class="header-right">
        <div class="badge" style="background:${ac};">${d.status === "DRAFT" ? "DRAFT" : esc(docLabel("invoice", data, opts).toUpperCase())}</div>
        ${paymentStatusBadge(d.status, pc)}
        ${complianceBadge(data, opts)}
        <div style="margin-top:12px;"><span class="label">${esc(docLabel("invoice", data, opts))} #</span><div class="value">${esc(d.number)}</div></div>
        <div style="margin-top:6px;"><span class="label">${esc(docLabel("date", data, opts))}</span><div class="value">${fd(d.date)}</div></div>
        ${d.dueDate ? `<div style="margin-top:6px;"><span class="label">${esc(docLabel("dueDate", data, opts))}</span><div class="value">${fd(d.dueDate)}</div></div>` : ""}
      </div>
    </div>
    <hr class="divider" />
    <div class="info-grid">
      <div class="box"><h3>${esc(docLabel("billTo", data, opts))}</h3>${customerInfo(data)}</div>
      <div class="box right-align"><h3>${esc(docLabel("paymentDetails", data, opts))}</h3><p>${esc(d.paymentMethod?.replace(/_/g, " ") || "N/A")}</p>${operationalInfo(data)}</div>
    </div>
    <table class="items">
      ${itemsHeader(data, opts)}
      <tbody>${itemsTable(data.items, opts)}</tbody>
    </table>
    ${notesBlock(data)}
    ${termsBlock(data)}
    <div class="summary-qr-wrap">
      <div>${totalsBlock(data, opts)}</div>
      ${qrBlock(data, opts)}
    </div>
    ${signatureBlock(opts)}
    ${barcodeBlock(d.number, opts)}
    <div class="footer">${opts.footerText ? esc(opts.footerText) : "Thank you for your business!"}</div>
  `;
  const styles = `
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .header-left { max-width:55%; }
    .header-left h1.company-name { font-size:16pt; font-weight:700; color:${pc}; margin-bottom:2px; }
    .header-left p { font-size:9pt; color:#64748b; line-height:1.6; }
    .header-right { text-align:right; }
    .badge { display:inline-block; background:${ac}; color:#fff; padding:4px 16px; font-size:9pt; font-weight:600; letter-spacing:1px; border-radius:4px; }
    .badge-paid { background:#10b981; margin-left:4px; }
    .badge-partial { background:#f59e0b; margin-left:4px; }
    .badge-unpaid { background:#dc2626; margin-left:4px; }
    .label { font-size:8pt; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; }
    .value { font-size:11pt; font-weight:600; color:${pc}; margin-top:2px; }
    .divider { border:none; border-top:1px solid #e2e8f0; margin:20px 0; }
    .info-grid { display:flex; justify-content:space-between; margin-bottom:24px; gap:24px; }
    .info-grid .box { flex:1; }
    .info-grid .box.right-align { text-align:right; }
    .info-grid .box h3 { font-size:8pt; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .info-grid .box p { font-size:10pt; color:#1e293b; }
    table.items { width:100%; border-collapse:collapse; margin-bottom:16px; }
    table.items thead { background:#f8fafc; }
    table.items th { padding:10px 12px; text-align:left; font-size:8pt; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e2e8f0; }
    table.items td { padding:10px 12px; font-size:10pt; border-bottom:1px solid #f1f5f9; }
    table.items tr.even td { background:#fafbfc; }
    table.items .right { text-align:right; }
    table.items tbody tr:last-child td { border-bottom:2px solid #e2e8f0; }
    .item-sku { font-size:8pt; color:#94a3b8; }
    .item-discount { font-size:8pt; color:#dc2626; }
    .summary-wrap { display:flex; justify-content:flex-end; }
    table.summary { width:320px; }
    table.summary td { padding:5px 0; font-size:10pt; }
    table.summary .right { text-align:right; }
    table.summary .total-row td { font-size:13pt; font-weight:700; color:${pc}; border-top:2px solid ${pc}; padding-top:8px; }
    table.summary .due-row td { color:#dc2626; font-weight:600; }
    .notes-box { background:#f8fafc; border-radius:6px; padding:12px 16px; margin-top:20px; }
    .notes-box .label { font-size:8pt; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .notes-box p { font-size:10pt; color:#475569; }
    .footer { text-align:center; margin-top:30px; padding-top:16px; border-top:1px solid #e2e8f0; font-size:9pt; color:#94a3b8; }
    .signature-row { display:flex; justify-content:space-between; margin-top:40px; gap:40px; }
    .signature-box { flex:1; }
    .signature-line { border-top:1px solid #cbd5e1; margin-bottom:4px; height:30px; }
    .signature-box p { font-size:9pt; color:#64748b; text-align:center; }
    .barcode-row { text-align:center; margin-top:16px; }
    .barcode-text { font-size:8pt; color:#94a3b8; font-family:monospace; margin-top:4px; }
    .summary-qr-wrap { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-top:16px; }
    .summary-qr-wrap .qr-row { flex-shrink:0; text-align:right; }
    .summary-qr-wrap .qr-container { display:inline-block; text-align:center; }
    .summary-qr-wrap .qr-img { display:block; border:1px solid #e2e8f0; border-radius:4px; padding:4px; width:90px; height:90px; }
    .summary-qr-wrap .qr-label { font-size:7pt; color:#64748b; margin-top:2px; }
    .summary-qr-wrap .qr-status { font-size:6pt; margin-top:1px; }
    .summary-qr-wrap .qr-status.verified { color:#10b981; }
    .summary-qr-wrap .qr-status.failed { color:#dc2626; }
    .summary-qr-wrap .qr-status.pending { color:#f59e0b; }
    .summary-qr-wrap .qr-irn { font-size:6pt; color:#94a3b8; margin-top:1px; word-break:break-all; }
    .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:60pt; font-weight:900; color:rgba(220,38,38,0.08); pointer-events:none; z-index:999; letter-spacing:20px; }
  `;
  return a4Wrapper(content, styles, opts);
}

export function renderCorporate(data: RenderData, opts: RenderOptions): string {
  const pc = opts.primaryColor;
  const ac = opts.accentColor;
  const d = data.document;
  const content = `
    ${statusWatermark(d.status)}
    <div class="top-strip" style="background:${ac};height:4px;margin:-15mm -15mm 20px;"></div>
    <div class="header">
      <div class="header-left">
        ${companyInfo(data, opts)}
      </div>
      <div class="header-right">
        <div class="badge" style="background:${ac};">${esc(docLabel("invoice", data, opts).toUpperCase())}</div>
        ${paymentStatusBadge(d.status, pc)}
        ${complianceBadge(data, opts)}
        <div style="margin-top:12px;"><span class="label">${esc(docLabel("invoice", data, opts))} #</span><div class="value">${esc(d.number)}</div></div>
        <div style="margin-top:6px;"><span class="label">Date</span><div class="value">${fd(d.date)}</div></div>
        ${d.dueDate ? `<div style="margin-top:6px;"><span class="label">Due Date</span><div class="value">${fd(d.dueDate)}</div></div>` : ""}
      </div>
    </div>
    <hr class="divider" />
    <div class="info-grid">
      <div class="box"><h3>Bill To</h3>${customerInfo(data)}</div>
      <div class="box right-align"><h3>Payment Details</h3><p>${esc(d.paymentMethod?.replace(/_/g, " ") || "N/A")}</p>${operationalInfo(data)}</div>
    </div>
    <table class="items">
      ${itemsHeader(data, opts)}
      <tbody>${itemsTable(data.items, opts)}</tbody>
    </table>
    <hr class="divider" />
    ${notesBlock(data)}
    ${termsBlock(data)}
    <div class="summary-qr-wrap">
      <div>${totalsBlock(data, opts)}</div>
      ${qrBlock(data, opts)}
    </div>
    ${signatureBlock(opts)}
    ${barcodeBlock(d.number, opts)}
    <div class="footer">${opts.footerText ? esc(opts.footerText) : "Thank you for your business!"}</div>
  `;
  const styles = `
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .header-left h1.company-name { font-size:18pt; font-weight:800; color:${pc}; letter-spacing:-0.5px; }
    .header-left p { font-size:9pt; color:#475569; line-height:1.6; }
    .header-right { text-align:right; }
    .badge { display:inline-block; background:${pc}; color:#fff; padding:4px 18px; font-size:9pt; font-weight:700; letter-spacing:1.5px; border-radius:2px; }
    .badge-paid { background:#059669; margin-left:4px; }
    .badge-partial { background:#d97706; margin-left:4px; }
    .badge-unpaid { background:#dc2626; margin-left:4px; }
    .label { font-size:8pt; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
    .value { font-size:11pt; font-weight:700; color:#1e293b; margin-top:2px; }
    .divider { border:none; border-top:1.5px solid ${ac}; margin:20px 0; opacity:0.3; }
    .info-grid { display:flex; justify-content:space-between; margin-bottom:24px; gap:24px; }
    .info-grid .box { flex:1; }
    .info-grid .box.right-align { text-align:right; }
    .info-grid .box h3 { font-size:9pt; color:#0f172a; font-weight:700; margin-bottom:6px; }
    .info-grid .box p { font-size:10pt; color:#334155; }
    table.items { width:100%; border-collapse:collapse; margin-bottom:16px; }
    table.items thead { background:${pc}; color:#fff; }
    table.items th { padding:10px 14px; text-align:left; font-size:8pt; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    table.items td { padding:10px 14px; font-size:10pt; border-bottom:1px solid #e2e8f0; }
    table.items .right { text-align:right; }
    table.items tbody tr:last-child td { border-bottom:3px solid ${pc}; }
    table.items tr.even td { background:#f8fafc; }
    .item-sku { font-size:8pt; color:#94a3b8; }
    .item-discount { font-size:8pt; color:#dc2626; }
    .summary-wrap { display:flex; justify-content:flex-end; }
    table.summary { width:320px; }
    table.summary td { padding:5px 0; font-size:10pt; }
    table.summary .right { text-align:right; }
    table.summary .total-row td { font-size:13pt; font-weight:700; color:${pc}; border-top:2px solid ${pc}; padding-top:8px; }
    table.summary .due-row td { color:#dc2626; font-weight:600; }
    .notes-box { background:#f8fafc; border-radius:8px; padding:14px 18px; margin-top:16px; border-left:4px solid ${ac}; }
    .notes-box .label { font-size:8pt; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .notes-box p { font-size:10pt; color:#475569; }
    .footer { text-align:center; margin-top:30px; padding-top:16px; border-top:2px solid ${pc}; font-size:9pt; color:#64748b; }
    .signature-row { display:flex; justify-content:space-between; margin-top:40px; gap:40px; }
    .signature-box { flex:1; }
    .signature-line { border-top:1px solid #cbd5e1; margin-bottom:4px; height:30px; }
    .signature-box p { font-size:9pt; color:#64748b; text-align:center; }
    .barcode-row { text-align:center; margin-top:16px; }
    .barcode-text { font-size:8pt; color:#94a3b8; font-family:monospace; margin-top:4px; }
    .badge-paid { background:#10b981; color:#fff; padding:4px 12px; border-radius:4px; font-size:8pt; font-weight:600; }
    .summary-qr-wrap { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-top:16px; }
    .summary-qr-wrap .qr-row { flex-shrink:0; text-align:right; }
    .summary-qr-wrap .qr-container { display:inline-block; text-align:center; }
    .summary-qr-wrap .qr-img { display:block; border:1px solid #e2e8f0; border-radius:4px; padding:4px; width:90px; height:90px; }
    .summary-qr-wrap .qr-label { font-size:7pt; color:#64748b; margin-top:2px; }
    .summary-qr-wrap .qr-status { font-size:6pt; margin-top:1px; }
    .summary-qr-wrap .qr-status.verified { color:#10b981; }
    .summary-qr-wrap .qr-status.failed { color:#dc2626; }
    .summary-qr-wrap .qr-status.pending { color:#f59e0b; }
    .summary-qr-wrap .qr-irn { font-size:6pt; color:#94a3b8; margin-top:1px; word-break:break-all; }
    .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:60pt; font-weight:900; color:rgba(220,38,38,0.08); pointer-events:none; z-index:999; letter-spacing:20px; }
  `;
  return a4Wrapper(content, styles, opts);
}

export function renderCleanAccounting(data: RenderData, opts: RenderOptions): string {
  const pc = opts.primaryColor;
  const ac = opts.accentColor;
  const d = data.document;
  const content = `
    ${statusWatermark(d.status)}
    <div class="border-strip" style="border-top:3px solid ${ac};margin:-15mm -15mm 0;padding:15mm 15mm 0;">
    <div class="header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
      <div>
        ${opts.showLogo && data.company.logo ? `<img src="${esc(data.company.logo)}" alt="Logo" style="max-height:55px;margin-bottom:8px;" />` : `<h1 style="font-size:16pt;font-weight:700;color:${pc};margin-bottom:2px;">${esc(data.company.name)}</h1>`}
        ${data.company.address ? `<p style="font-size:9pt;color:#475569;">${esc(data.company.address)}</p>` : ""}
        ${data.company.city ? `<p style="font-size:9pt;color:#475569;">${esc(data.company.city)}${data.company.state ? ", " + esc(data.company.state) : ""}${data.company.zipCode ? " - " + esc(data.company.zipCode) : ""}</p>` : ""}
        ${data.company.phone || data.company.email ? `<p style="font-size:9pt;color:#475569;">${[data.company.phone, data.company.email].filter(Boolean).join(" | ")}</p>` : ""}
        ${data.company.taxId ? `<p style="font-size:9pt;color:#475569;">${esc(opts.taxName)}: ${esc(data.company.taxId)}</p>` : ""}
      </div>
      <div style="text-align:right;">
        <div style="font-size:14pt;font-weight:700;color:${pc};border-bottom:2px solid ${ac};padding-bottom:6px;margin-bottom:8px;">${esc(docLabel("invoice", data, opts).toUpperCase())}</div>
        <span style="margin-left:4px;">${paymentStatusBadge(d.status, pc)}</span>
        <span style="margin-left:4px;">${complianceBadge(data, opts)}</span>
        <table style="font-size:9pt;color:#475569;"><tr><td style="text-align:right;padding:2px 8px 2px 0;">#:</td><td><strong>${esc(d.number)}</strong></td></tr>
        <tr><td style="text-align:right;padding:2px 8px 2px 0;">Date:</td><td>${fd(d.date)}</td></tr>
        ${d.dueDate ? `<tr><td style="text-align:right;padding:2px 8px 2px 0;">Due:</td><td>${fd(d.dueDate)}</td></tr>` : ""}
        <tr><td style="text-align:right;padding:2px 8px 2px 0;">Status:</td><td>${d.status === "DRAFT" ? "DRAFT" : "—"}</td></tr></table>
      </div>
    </div>
    <hr style="border:none;border-top:2px solid #e2e8f0;margin:16px 0;" />
    <div style="display:flex;gap:24px;margin-bottom:20px;">
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:14px;">
        <h3 style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Bill To</h3>
        ${customerInfo(data)}
      </div>
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:14px;">
        <h3 style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Payment</h3>
        <p style="font-size:10pt;">${esc(d.paymentMethod?.replace(/_/g, " ") || "N/A")}</p>
        ${operationalInfo(data)}
      </div>
    </div>
    <table class="items">
      ${itemsHeader(data, opts)}
      <tbody>${itemsTable(data.items, opts)}</tbody>
    </table>
    <div class="summary-qr-wrap">
      <div>${totalsBlock(data, opts)}</div>
      ${qrBlock(data, opts)}
    </div>
    ${notesBlock(data)}
    ${termsBlock(data)}
    ${signatureBlock(opts)}
    ${barcodeBlock(d.number, opts)}
    </div>
    <div class="footer" style="text-align:center;margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:9pt;color:#94a3b8;">${opts.footerText ? esc(opts.footerText) : "Thank you for your business!"}</div>
  `;
  const styles = `
    table.items { width:100%; border-collapse:collapse; margin-bottom:16px; }
    table.items thead { background:${ac}; color:#fff; }
    table.items th { padding:10px 14px; text-align:left; font-size:8pt; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    table.items td { padding:10px 14px; font-size:10pt; border-bottom:1px solid #e2e8f0; }
    table.items .right { text-align:right; }
    table.items tbody tr:last-child td { border-bottom:2px solid ${ac}; }
    table.items tr.even td { background:#fafbfc; }
    .summary-wrap { display:flex; justify-content:flex-end; }
    table.summary { width:320px; }
    table.summary td { padding:5px 0; font-size:10pt; }
    table.summary .right { text-align:right; }
    table.summary .total-row td { font-size:13pt; font-weight:700; color:${pc}; border-top:2px solid ${pc}; padding-top:8px; }
    table.summary .due-row td { color:#dc2626; font-weight:600; }
    .notes-box { margin-top:16px; padding:12px 16px; background:#f1f5f9; border-radius:4px; }
    .notes-box .label { font-size:8pt; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .notes-box p { font-size:10pt; color:#475569; }
    .signature-row { display:flex; justify-content:space-between; margin-top:40px; gap:40px; }
    .signature-box { flex:1; }
    .signature-line { border-top:1px solid #cbd5e1; margin-bottom:4px; height:30px; }
    .signature-box p { font-size:9pt; color:#64748b; text-align:center; }
    .barcode-row { text-align:center; margin-top:16px; }
    .barcode-text { font-size:8pt; color:#94a3b8; font-family:monospace; margin-top:4px; }
    .badge-paid { background:#10b981; color:#fff; padding:4px 12px; border-radius:4px; font-size:8pt; font-weight:600; }
    .summary-qr-wrap { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-top:16px; }
    .summary-qr-wrap .qr-row { flex-shrink:0; text-align:right; }
    .summary-qr-wrap .qr-container { display:inline-block; text-align:center; }
    .summary-qr-wrap .qr-img { display:block; border:1px solid #e2e8f0; border-radius:4px; padding:4px; width:90px; height:90px; }
    .summary-qr-wrap .qr-label { font-size:7pt; color:#64748b; margin-top:2px; }
    .summary-qr-wrap .qr-status { font-size:6pt; margin-top:1px; }
    .summary-qr-wrap .qr-status.verified { color:#10b981; }
    .summary-qr-wrap .qr-status.failed { color:#dc2626; }
    .summary-qr-wrap .qr-status.pending { color:#f59e0b; }
    .summary-qr-wrap .qr-irn { font-size:6pt; color:#94a3b8; margin-top:1px; word-break:break-all; }
    .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:60pt; font-weight:900; color:rgba(220,38,38,0.08); pointer-events:none; z-index:999; letter-spacing:20px; }
  `;
  return a4Wrapper(content, styles, opts);
}

export function renderBoldCommercial(data: RenderData, opts: RenderOptions): string {
  const pc = opts.primaryColor;
  const ac = opts.accentColor;
  const d = data.document;
  const content = `
    ${statusWatermark(d.status)}
    <div class="header-bar" style="background:linear-gradient(135deg,${pc},${ac});padding:24px 28px;margin:-15mm -15mm 20px;color:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h1 style="font-size:20pt;font-weight:900;letter-spacing:1px;">${esc(data.company.name)}</h1>
          <p style="font-size:10pt;opacity:0.8;margin-top:2px;">${data.company.address || ""}${data.company.city ? ", " + esc(data.company.city) : ""}</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:28pt;font-weight:900;letter-spacing:3px;line-height:1;">${esc(docLabel("invoice", data, opts).toUpperCase())}</div>
          <div style="font-size:10pt;opacity:0.7;margin-top:2px;">${esc(d.number)}</div>
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding:12px 16px;background:#fff5f5;border-radius:8px;">
      <div>
        <p style="font-size:9pt;color:#64748b;">${[data.company.phone, data.company.email].filter(Boolean).join(" | ")}</p>
        ${data.company.taxId ? `<p style="font-size:9pt;color:#64748b;">${esc(opts.taxName)}: ${esc(data.company.taxId)}</p>` : ""}
      </div>
      <div style="text-align:right;">
        <div style="display:inline-block;background:${ac};color:#fff;padding:6px 20px;font-size:10pt;font-weight:700;border-radius:4px;">${esc(docLabel("invoice", data, opts).toUpperCase())}</div>
        ${paymentStatusBadge(d.status, pc)}
        ${complianceBadge(data, opts)}
      </div>
    </div>
    <div style="display:flex;gap:24px;margin-bottom:20px;">
      <div style="flex:1;"><h3 style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Bill To</h3>${customerInfo(data)}</div>
      <div style="flex:1;text-align:right;">
        <h3 style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Invoice Details</h3>
        <p style="font-size:10pt;"><strong>Date:</strong> ${fd(d.date)}</p>
        ${d.dueDate ? `<p style="font-size:10pt;"><strong>Due:</strong> ${fd(d.dueDate)}</p>` : ""}
        <p style="font-size:10pt;"><strong>Payment:</strong> ${esc(d.paymentMethod?.replace(/_/g, " ") || "N/A")}</p>
        ${operationalInfo(data)}
      </div>
    </div>
    <table class="items">
      ${itemsHeader(data, opts)}
      <tbody>${itemsTable(data.items, opts)}</tbody>
    </table>
    <div class="summary-qr-wrap">
      <div>${totalsBlock(data, opts)}</div>
      ${qrBlock(data, opts)}
    </div>
    ${notesBlock(data)}
    ${termsBlock(data)}
    ${signatureBlock(opts)}
    ${barcodeBlock(d.number, opts)}
    <div class="footer">${opts.footerText ? esc(opts.footerText) : "Thank you for your business!"}</div>
  `;
  const styles = `
    table.items { width:100%; border-collapse:collapse; margin-bottom:16px; }
    table.items thead { background:${pc}; color:#fff; }
    table.items th { padding:12px 14px; text-align:left; font-size:9pt; font-weight:700; }
    table.items td { padding:12px 14px; font-size:10pt; border-bottom:1px solid #e2e8f0; }
    table.items .right { text-align:right; }
    table.items tbody tr:last-child td { border-bottom:3px solid ${pc}; }
    table.items tr.even td { background:#fafbfc; }
    .summary-wrap { display:flex; justify-content:flex-end; }
    table.summary { width:320px; }
    table.summary td { padding:6px 0; font-size:10pt; }
    table.summary .right { text-align:right; }
    table.summary .total-row td { font-size:14pt; font-weight:800; color:${pc}; border-top:3px solid ${pc}; padding-top:10px; }
    table.summary .due-row td { color:#dc2626; font-weight:700; }
    .notes-box { margin-top:16px; padding:14px 18px; background:#fef2f2; border-radius:6px; border-left:4px solid ${ac}; }
    .notes-box .label { font-size:8pt; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .notes-box p { font-size:10pt; color:#475569; }
    .footer { text-align:center; margin-top:30px; padding-top:14px; border-top:2px solid #e2e8f0; font-size:9pt; color:#94a3b8; }
    .signature-row { display:flex; justify-content:space-between; margin-top:40px; gap:40px; }
    .signature-box { flex:1; }
    .signature-line { border-top:1px solid #cbd5e1; margin-bottom:4px; height:30px; }
    .signature-box p { font-size:9pt; color:#64748b; text-align:center; }
    .barcode-row { text-align:center; margin-top:16px; }
    .barcode-text { font-size:8pt; color:#94a3b8; font-family:monospace; margin-top:4px; }
    .badge-paid { background:#10b981; color:#fff; padding:4px 12px; border-radius:4px; font-size:8pt; font-weight:600; display:inline-block; }
    .summary-qr-wrap { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-top:16px; }
    .summary-qr-wrap .qr-row { flex-shrink:0; text-align:right; }
    .summary-qr-wrap .qr-container { display:inline-block; text-align:center; }
    .summary-qr-wrap .qr-img { display:block; border:1px solid #e2e8f0; border-radius:4px; padding:4px; width:90px; height:90px; }
    .summary-qr-wrap .qr-label { font-size:7pt; color:#64748b; margin-top:2px; }
    .summary-qr-wrap .qr-status { font-size:6pt; margin-top:1px; }
    .summary-qr-wrap .qr-status.verified { color:#10b981; }
    .summary-qr-wrap .qr-status.failed { color:#dc2626; }
    .summary-qr-wrap .qr-status.pending { color:#f59e0b; }
    .summary-qr-wrap .qr-irn { font-size:6pt; color:#94a3b8; margin-top:1px; word-break:break-all; }
    .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:60pt; font-weight:900; color:rgba(220,38,38,0.08); pointer-events:none; z-index:999; letter-spacing:20px; }
  `;
  return a4Wrapper(content, styles, opts);
}

export function renderPremiumBusiness(data: RenderData, opts: RenderOptions): string {
  const pc = opts.primaryColor;
  const ac = opts.accentColor;
  const d = data.document;
  const content = `
    ${statusWatermark(d.status)}
    <div style="border:2px solid ${pc};border-radius:4px;padding:4px;min-height:calc(100vh - 30mm);">
    <div style="border:1px solid #e2e8f0;border-radius:2px;padding:28px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div style="flex:1;">
          ${opts.showLogo && data.company.logo ? `<img src="${esc(data.company.logo)}" alt="Logo" style="max-height:60px;margin-bottom:12px;" />` : ""}
          <h1 style="font-size:22pt;font-weight:300;color:${pc};letter-spacing:2px;text-transform:uppercase;">${esc(data.company.name)}</h1>
          <div style="margin-top:8px;font-size:9pt;color:#64748b;line-height:1.6;">
            ${data.company.address ? `<p>${esc(data.company.address)}</p>` : ""}
            ${data.company.city ? `<p>${esc(data.company.city)}${data.company.state ? ", " + esc(data.company.state) : ""}${data.company.zipCode ? " " + esc(data.company.zipCode) : ""}</p>` : ""}
            ${data.company.phone || data.company.email ? `<p>${[data.company.phone, data.company.email].filter(Boolean).join(" | ")}</p>` : ""}
            ${data.company.taxId ? `<p>${esc(opts.taxName)}: ${esc(data.company.taxId)}</p>` : ""}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="background:${pc};color:#fff;padding:8px 24px;font-size:11pt;font-weight:600;letter-spacing:1px;margin-bottom:12px;">${esc(docLabel("invoice", data, opts).toUpperCase())}</div>
          ${paymentStatusBadge(d.status, pc)}
          ${complianceBadge(data, opts)}
          <table style="font-size:9pt;margin-left:auto;">
            <tr><td style="padding:2px 8px;color:#94a3b8;">Number</td><td style="padding:2px 0;font-weight:600;">${esc(d.number)}</td></tr>
            <tr><td style="padding:2px 8px;color:#94a3b8;">Date</td><td style="padding:2px 0;">${fd(d.date)}</td></tr>
            ${d.dueDate ? `<tr><td style="padding:2px 8px;color:#94a3b8;">Due</td><td style="padding:2px 0;">${fd(d.dueDate)}</td></tr>` : ""}
            <tr><td style="padding:2px 8px;color:#94a3b8;">Status</td><td style="padding:2px 0;">${d.status === "DRAFT" ? "DRAFT" : "—"}</td></tr>
          </table>
        </div>
      </div>
      <hr style="border:none;border-top:2px solid ${ac};margin:20px 0;" />
      <div style="display:flex;gap:24px;margin-bottom:24px;">
        <div style="flex:1;background:#fafbfc;padding:16px;border-radius:4px;">
          <p style="font-size:7pt;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Bill To</p>
          ${customerInfo(data)}
        </div>
        <div style="flex:1;background:#fafbfc;padding:16px;border-radius:4px;">
          <p style="font-size:7pt;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Payment</p>
          <p style="font-size:10pt;">${esc(d.paymentMethod?.replace(/_/g, " ") || "N/A")}</p>
          ${operationalInfo(data)}
        </div>
      </div>
      <table class="items">
        ${itemsHeader(data, opts)}
        <tbody>${itemsTable(data.items, opts)}</tbody>
      </table>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
      <div class="summary-qr-wrap">
        <div>${totalsBlock(data, opts)}</div>
        ${qrBlock(data, opts)}
      </div>
      ${notesBlock(data)}
      ${termsBlock(data)}
      ${signatureBlock(opts)}
      ${barcodeBlock(d.number, opts)}
    </div>
    </div>
    <div class="footer" style="text-align:center;margin-top:20px;font-size:9pt;color:#94a3b8;">${opts.footerText ? esc(opts.footerText) : "Thank you for your business!"}</div>
  `;
  const styles = `
    table.items { width:100%; border-collapse:collapse; margin-bottom:8px; }
    table.items thead tr { border-bottom:2px solid ${pc}; }
    table.items th { padding:8px 12px; text-align:left; font-size:8pt; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
    table.items td { padding:10px 12px; font-size:10pt; border-bottom:1px solid #f1f5f9; }
    table.items .right { text-align:right; }
    table.items tr.even td { background:#fafbfc; }
    .summary-wrap { display:flex; justify-content:flex-end; }
    table.summary { width:300px; }
    table.summary td { padding:5px 0; font-size:10pt; }
    table.summary .right { text-align:right; }
    table.summary .total-row td { font-size:13pt; font-weight:700; color:${pc}; border-top:2px solid ${pc}; padding-top:8px; }
    table.summary .due-row td { color:#dc2626; font-weight:600; }
    .notes-box { margin-top:16px; padding:12px 16px; background:#f1f5f9; border-radius:4px; }
    .notes-box .label { font-size:8pt; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
    .notes-box p { font-size:10pt; color:#475569; }
    .signature-row { display:flex; justify-content:space-between; margin-top:40px; gap:40px; }
    .signature-box { flex:1; }
    .signature-line { border-top:1px solid #cbd5e1; margin-bottom:4px; height:30px; }
    .signature-box p { font-size:9pt; color:#64748b; text-align:center; }
    .barcode-row { text-align:center; margin-top:16px; }
    .barcode-text { font-size:8pt; color:#94a3b8; font-family:monospace; margin-top:4px; }
    .badge-paid { background:#10b981; color:#fff; padding:4px 12px; border-radius:4px; font-size:8pt; font-weight:600; display:inline-block; }
    .summary-qr-wrap { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-top:16px; }
    .summary-qr-wrap .qr-row { flex-shrink:0; text-align:right; }
    .summary-qr-wrap .qr-container { display:inline-block; text-align:center; }
    .summary-qr-wrap .qr-img { display:block; border:1px solid #e2e8f0; border-radius:4px; padding:4px; width:90px; height:90px; }
    .summary-qr-wrap .qr-label { font-size:7pt; color:#64748b; margin-top:2px; }
    .summary-qr-wrap .qr-status { font-size:6pt; margin-top:1px; }
    .summary-qr-wrap .qr-status.verified { color:#10b981; }
    .summary-qr-wrap .qr-status.failed { color:#dc2626; }
    .summary-qr-wrap .qr-status.pending { color:#f59e0b; }
    .summary-qr-wrap .qr-irn { font-size:6pt; color:#94a3b8; margin-top:1px; word-break:break-all; }
    .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:60pt; font-weight:900; color:rgba(220,38,38,0.08); pointer-events:none; z-index:999; letter-spacing:20px; }
  `;
  return a4Wrapper(content, styles, opts);
}
