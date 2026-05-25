import type { RenderData, RenderOptions } from "@/lib/template-registry";
import { docLabel } from "@/lib/document-labels";
import {
  esc,
  fmt,
  fd,
  companyInfo,
  customerInfo,
  itemsTable,
  itemsHeader,
  notesBlock,
  termsBlock,
  signatureBlock,
  statusWatermark,
  wrapHtml,
} from "./shared";

function qWrapper(content: string, styles: string, opts: RenderOptions): string {
  const wrapperStyles = `
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .header-left { max-width:55%; }
    .header-left h1.company-name { font-size:16pt; font-weight:700; color:${opts.primaryColor}; margin-bottom:2px; }
    .header-left p { font-size:9pt; color:#64748b; line-height:1.6; }
    .header-right { text-align:right; }
    .badge { display:inline-block; background:${opts.accentColor}; color:#fff; padding:4px 16px; font-size:9pt; font-weight:600; letter-spacing:1px; border-radius:4px; }
    .label { font-size:8pt; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; }
    .value { font-size:11pt; font-weight:600; color:${opts.primaryColor}; margin-top:2px; }
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
    .summary-wrap { display:flex; justify-content:flex-end; }
    table.summary { width:320px; }
    table.summary td { padding:5px 0; font-size:10pt; }
    table.summary .right { text-align:right; }
    table.summary .total-row td { font-size:13pt; font-weight:700; color:${opts.primaryColor}; border-top:2px solid ${opts.primaryColor}; padding-top:8px; }
    .notes-box { background:#f8fafc; border-radius:6px; padding:12px 16px; margin-top:20px; }
    .notes-box .label { font-size:8pt; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .notes-box p { font-size:10pt; color:#475569; }
    .footer { text-align:center; margin-top:30px; padding-top:16px; border-top:1px solid #e2e8f0; font-size:9pt; color:#94a3b8; }
    .validity { background:#fefce8; border:1px solid #fde68a; border-radius:4px; padding:8px 12px; margin-top:16px; font-size:9pt; color:#92400e; text-align:center; }
    .signature-row { display:flex; justify-content:space-between; margin-top:40px; gap:40px; }
    .signature-box { flex:1; }
    .signature-line { border-top:1px solid #cbd5e1; margin-bottom:4px; height:30px; }
    .signature-box p { font-size:9pt; color:#64748b; text-align:center; }
    .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:60pt; font-weight:900; color:rgba(220,38,38,0.08); pointer-events:none; z-index:999; letter-spacing:20px; }
    ${styles}
  `;
  return wrapHtml(content, wrapperStyles, opts);
}

export function renderQuotationModernMinimal(data: RenderData, opts: RenderOptions): string {
  const pc = opts.primaryColor;
  const ac = opts.accentColor;
  const d = data.document;
  const content = `
    ${statusWatermark(d.status)}
    <div class="top-strip" style="background:${ac};height:4px;margin:-15mm -15mm 20px;"></div>
    <div class="header">
      <div class="header-left">${companyInfo(data, opts)}</div>
      <div class="header-right">
        <div class="badge" style="background:${ac};">${esc(docLabel("quotation", data, opts).toUpperCase())}</div>
        <div style="margin-top:12px;"><span class="label">${esc(docLabel("quotation", data, opts))} #</span><div class="value">${esc(d.number)}</div></div>
        <div style="margin-top:6px;"><span class="label">${esc(docLabel("date", data, opts))}</span><div class="value">${fd(d.date)}</div></div>
        ${d.dueDate ? `<div style="margin-top:6px;"><span class="label">${esc(docLabel("validUntil", data, opts))}</span><div class="value">${fd(d.dueDate)}</div></div>` : ""}
        <div style="margin-top:6px;"><span class="label">Status</span><div class="value" style="font-size:10pt;">${d.status.replace(/_/g, " ")}</div></div>
      </div>
    </div>
    <hr class="divider" />
    <div class="info-grid">
      <div class="box"><h3>${esc(docLabel("preparedFor", data, opts))}</h3>${customerInfo(data)}</div>
      <div class="box right-align"><h3>${esc(docLabel("quoteDetails", data, opts))}</h3><p>${d.createdByName ? `${esc(docLabel("preparedBy", data, opts))}: ${esc(d.createdByName)}` : ""}</p></div>
    </div>
    <table class="items">
      ${itemsHeader(data, opts)}
      <tbody>${itemsTable(data.items, opts)}</tbody>
    </table>
    <div class="summary-wrap"><table class="summary">${totalsQuotation(data, opts)}</table></div>
    ${notesBlock(data)}
    ${termsBlock(data)}
    ${d.dueDate ? `<div class="validity">This quotation is valid until ${fd(d.dueDate)}</div>` : ""}
    ${signatureBlock(opts)}
    <div class="footer">${opts.footerText ? esc(opts.footerText) : "Thank you for the opportunity to quote!"}</div>
  `;
  return qWrapper(content, "", opts);
}

export function renderQuotationCorporate(data: RenderData, opts: RenderOptions): string {
  const pc = opts.primaryColor;
  const ac = opts.accentColor;
  const d = data.document;
  const content = `
    ${statusWatermark(d.status)}
    <div class="top-header" style="background:${pc};color:#fff;padding:20px 24px;margin:-15mm -15mm 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          ${opts.showLogo && data.company.logo ? `<img src="${esc(data.company.logo)}" alt="Logo" style="max-height:50px;margin-bottom:6px;" />` : ""}
          <h1 style="font-size:18pt;font-weight:700;">${esc(data.company.name)}</h1>
        </div>
        <div style="text-align:right;">
          <div style="font-size:22pt;font-weight:800;letter-spacing:2px;opacity:0.9;">QUOTATION</div>
          <div style="font-size:10pt;opacity:0.7;">${esc(d.number)}</div>
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;padding:0 4px;">
      <div style="font-size:9pt;color:#64748b;">
        ${data.company.address ? `<p>${esc(data.company.address)}</p>` : ""}
        ${data.company.phone || data.company.email ? `<p>${[data.company.phone, data.company.email].filter(Boolean).join(" | ")}</p>` : ""}
        ${data.company.taxId ? `<p>${esc(opts.taxName)}: ${esc(data.company.taxId)}</p>` : ""}
      </div>
      <div style="text-align:right;font-size:9pt;color:#64748b;">
        <p>Date: ${fd(d.date)}</p>
        ${d.dueDate ? `<p>Valid Until: ${fd(d.dueDate)}</p>` : ""}
        <p>Status: ${d.status.replace(/_/g, " ")}</p>
      </div>
    </div>
    <div style="display:flex;gap:20px;margin-bottom:20px;">
      <div style="flex:1;background:#f8fafc;border-radius:8px;padding:16px;border-left:4px solid ${ac};">
        <h3 style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Prepared For</h3>
        ${customerInfo(data)}
      </div>
      <div style="flex:1;text-align:right;padding-top:16px;">
        <div style="display:inline-block;background:${ac};color:#fff;padding:6px 20px;font-size:10pt;font-weight:600;border-radius:4px;">QUOTATION</div>
      </div>
    </div>
    <table class="items">
      ${itemsHeader(data, opts, "description")}
      <tbody>${itemsTable(data.items, opts)}</tbody>
    </table>
    <div class="summary-wrap"><table class="summary">${totalsQuotation(data, opts)}</table></div>
    ${notesBlock(data)}
    ${termsBlock(data)}
    ${d.dueDate ? `<div class="validity">This quotation is valid until ${fd(d.dueDate)}</div>` : ""}
    ${signatureBlock(opts)}
    <div class="footer">${opts.footerText ? esc(opts.footerText) : "Thank you for the opportunity to quote!"}</div>
  `;
  return qWrapper(
    content,
    `
    table.items thead { background:${pc}; color:#fff; }
    table.items th { padding:10px 14px; text-align:left; font-size:8pt; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    table.items td { padding:10px 14px; font-size:10pt; border-bottom:1px solid #e2e8f0; }
    table.items tbody tr:last-child td { border-bottom:2px solid ${pc}; }
    table.items tr.even td { background:#f8fafc; }
    table.summary .total-row td { font-size:13pt; font-weight:700; color:${pc}; border-top:2px solid ${pc}; padding-top:8px; }
    .notes-box { background:#f8fafc; border-radius:8px; padding:14px 18px; margin-top:16px; border-left:4px solid ${ac}; }
    .footer { border-top:2px solid ${pc}; }
  `,
    opts,
  );
}

export function renderQuotationCleanAccounting(data: RenderData, opts: RenderOptions): string {
  const pc = opts.primaryColor;
  const ac = opts.accentColor;
  const d = data.document;
  const content = `
    ${statusWatermark(d.status)}
    <div style="border-top:3px solid ${ac};margin:-15mm -15mm 0;padding:15mm 15mm 0;">
    <div class="header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
      <div>
        ${opts.showLogo && data.company.logo ? `<img src="${esc(data.company.logo)}" alt="Logo" style="max-height:55px;margin-bottom:8px;" />` : `<h1 style="font-size:16pt;font-weight:700;color:${pc};margin-bottom:2px;">${esc(data.company.name)}</h1>`}
        ${companyInfo(data, opts)}
      </div>
      <div style="text-align:right;">
        <div style="font-size:14pt;font-weight:700;color:${pc};border-bottom:2px solid ${ac};padding-bottom:6px;margin-bottom:8px;">QUOTATION</div>
        <table style="font-size:9pt;color:#475569;margin-left:auto;">
          <tr><td style="text-align:right;padding:2px 8px 2px 0;">#:</td><td><strong>${esc(d.number)}</strong></td></tr>
          <tr><td style="text-align:right;padding:2px 8px 2px 0;">Date:</td><td>${fd(d.date)}</td></tr>
          ${d.dueDate ? `<tr><td style="text-align:right;padding:2px 8px 2px 0;">Valid:</td><td>${fd(d.dueDate)}</td></tr>` : ""}
          <tr><td style="text-align:right;padding:2px 8px 2px 0;">Status:</td><td>${d.status.replace(/_/g, " ")}</td></tr>
        </table>
      </div>
    </div>
    <hr style="border:none;border-top:2px solid #e2e8f0;margin:16px 0;" />
    <div style="display:flex;gap:24px;margin-bottom:20px;">
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:14px;">
        <h3 style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Prepared For</h3>
        ${customerInfo(data)}
      </div>
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:14px;">
        <h3 style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Quote Info</h3>
        <p style="font-size:10pt;">${d.createdByName ? `By: ${esc(d.createdByName)}` : "—"}</p>
      </div>
    </div>
    <table class="items">
      ${itemsHeader(data, opts)}
      <tbody>${itemsTable(data.items, opts)}</tbody>
    </table>
    <div class="summary-wrap"><table class="summary">${totalsQuotation(data, opts)}</table></div>
    ${notesBlock(data)}
    ${termsBlock(data)}
    ${d.dueDate ? `<div class="validity">This quotation is valid until ${fd(d.dueDate)}</div>` : ""}
    ${signatureBlock(opts)}
    </div>
    <div class="footer">${opts.footerText ? esc(opts.footerText) : "Thank you for the opportunity to quote!"}</div>
  `;
  return qWrapper(
    content,
    `
    table.items thead { background:${ac}; color:#fff; }
    table.items th { padding:10px 14px; font-size:8pt; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    table.items tbody tr:last-child td { border-bottom:2px solid ${ac}; }
    table.summary .total-row td { border-top:2px solid ${pc}; }
    .validity { background:#fefce8; border:1px solid #fde68a; border-radius:4px; padding:8px 12px; margin-top:16px; font-size:9pt; color:#92400e; text-align:center; }
  `,
    opts,
  );
}

export function renderQuotationBoldCommercial(data: RenderData, opts: RenderOptions): string {
  const pc = opts.primaryColor;
  const ac = opts.accentColor;
  const d = data.document;
  const content = `
    ${statusWatermark(d.status)}
    <div style="background:linear-gradient(135deg,${pc},${ac});padding:24px 28px;margin:-15mm -15mm 20px;color:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h1 style="font-size:20pt;font-weight:900;letter-spacing:1px;">${esc(data.company.name)}</h1>
          <p style="font-size:10pt;opacity:0.8;margin-top:2px;">${data.company.address || ""}${data.company.city ? ", " + esc(data.company.city) : ""}</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:26pt;font-weight:900;letter-spacing:3px;line-height:1;">QUOTATION</div>
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
        <div style="display:inline-block;background:${ac};color:#fff;padding:6px 20px;font-size:10pt;font-weight:700;border-radius:4px;">QUOTATION</div>
        <p style="font-size:8pt;color:#64748b;margin-top:4px;">${d.status.replace(/_/g, " ")}</p>
      </div>
    </div>
    <div style="display:flex;gap:24px;margin-bottom:20px;">
      <div style="flex:1;"><h3 style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Prepared For</h3>${customerInfo(data)}</div>
      <div style="flex:1;text-align:right;">
        <h3 style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Quote Details</h3>
        <p style="font-size:10pt;"><strong>Date:</strong> ${fd(d.date)}</p>
        ${d.dueDate ? `<p style="font-size:10pt;"><strong>Valid Until:</strong> ${fd(d.dueDate)}</p>` : ""}
        ${d.createdByName ? `<p style="font-size:9pt;color:#64748b;margin-top:4px;">By: ${esc(d.createdByName)}</p>` : ""}
      </div>
    </div>
    <table class="items">
      ${itemsHeader(data, opts)}
      <tbody>${itemsTable(data.items, opts)}</tbody>
    </table>
    <div class="summary-wrap"><table class="summary">${totalsQuotation(data, opts)}</table></div>
    ${notesBlock(data)}
    ${termsBlock(data)}
    ${d.dueDate ? `<div class="validity">This quotation is valid until ${fd(d.dueDate)}</div>` : ""}
    ${signatureBlock(opts)}
    <div class="footer">${opts.footerText ? esc(opts.footerText) : "Thank you for the opportunity to quote!"}</div>
  `;
  return qWrapper(
    content,
    `
    table.items thead { background:${pc}; color:#fff; }
    table.items th { padding:12px 14px; font-size:9pt; font-weight:700; }
    table.items td { padding:12px 14px; border-bottom:1px solid #e2e8f0; }
    table.items tbody tr:last-child td { border-bottom:3px solid ${pc}; }
    table.summary .total-row td { font-size:14pt; font-weight:800; border-top:3px solid ${pc}; padding-top:10px; }
    .notes-box { background:#fef2f2; border-left:4px solid ${ac}; }
    .footer { border-top:2px solid #e2e8f0; }
    .validity { background:#fefce8; border:1px solid #fde68a; border-radius:4px; padding:8px 12px; margin-top:16px; font-size:9pt; color:#92400e; text-align:center; }
  `,
    opts,
  );
}

export function renderQuotationPremiumBusiness(data: RenderData, opts: RenderOptions): string {
  const pc = opts.primaryColor;
  const ac = opts.accentColor;
  const d = data.document;
  const content = `
    ${statusWatermark(d.status)}
    <div style="border:2px solid ${pc};border-radius:4px;padding:4px;">
    <div style="border:1px solid #e2e8f0;border-radius:2px;padding:28px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div style="flex:1;">
          ${opts.showLogo && data.company.logo ? `<img src="${esc(data.company.logo)}" alt="Logo" style="max-height:60px;margin-bottom:12px;" />` : ""}
          <h1 style="font-size:22pt;font-weight:300;color:${pc};letter-spacing:2px;text-transform:uppercase;">${esc(data.company.name)}</h1>
          <div style="margin-top:8px;font-size:9pt;color:#64748b;line-height:1.6;">
            ${data.company.address ? `<p>${esc(data.company.address)}</p>` : ""}
            ${data.company.phone || data.company.email ? `<p>${[data.company.phone, data.company.email].filter(Boolean).join(" | ")}</p>` : ""}
            ${data.company.taxId ? `<p>${esc(opts.taxName)}: ${esc(data.company.taxId)}</p>` : ""}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="background:${pc};color:#fff;padding:8px 24px;font-size:11pt;font-weight:600;letter-spacing:1px;margin-bottom:12px;">QUOTATION</div>
          <table style="font-size:9pt;margin-left:auto;">
            <tr><td style="padding:2px 8px;color:#94a3b8;">Number</td><td style="padding:2px 0;font-weight:600;">${esc(d.number)}</td></tr>
            <tr><td style="padding:2px 8px;color:#94a3b8;">Date</td><td style="padding:2px 0;">${fd(d.date)}</td></tr>
            ${d.dueDate ? `<tr><td style="padding:2px 8px;color:#94a3b8;">Valid</td><td style="padding:2px 0;">${fd(d.dueDate)}</td></tr>` : ""}
            <tr><td style="padding:2px 8px;color:#94a3b8;">Status</td><td style="padding:2px 0;">${d.status.replace(/_/g, " ")}</td></tr>
          </table>
        </div>
      </div>
      <hr style="border:none;border-top:2px solid ${ac};margin:20px 0;" />
      <div style="display:flex;gap:24px;margin-bottom:24px;">
        <div style="flex:1;background:#fafbfc;padding:16px;border-radius:4px;">
          <p style="font-size:7pt;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Prepared For</p>
          ${customerInfo(data)}
        </div>
        <div style="flex:1;background:#fafbfc;padding:16px;border-radius:4px;">
          <p style="font-size:7pt;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Quote Info</p>
          <p style="font-size:10pt;">${d.createdByName ? `By: ${esc(d.createdByName)}` : "—"}</p>
        </div>
      </div>
      <table class="items">
        ${itemsHeader(data, opts)}
        <tbody>${itemsTable(data.items, opts)}</tbody>
      </table>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
      <div class="summary-wrap"><table class="summary">${totalsQuotation(data, opts)}</table></div>
      ${notesBlock(data)}
      ${termsBlock(data)}
      ${d.dueDate ? `<div class="validity">This quotation is valid until ${fd(d.dueDate)}</div>` : ""}
      ${signatureBlock(opts)}
    </div>
    </div>
    <div class="footer">${opts.footerText ? esc(opts.footerText) : "Thank you for the opportunity to quote!"}</div>
  `;
  return qWrapper(
    content,
    `
    table.items thead tr { border-bottom:2px solid ${pc}; }
    table.items th { padding:8px 12px; font-size:8pt; font-weight:600; color:#64748b; }
    table.items td { padding:10px 12px; border-bottom:1px solid #f1f5f9; }
    table.summary { width:300px; }
    table.summary .total-row td { border-top:2px solid ${pc}; }
    .validity { background:#fefce8; border:1px solid #fde68a; border-radius:4px; padding:8px 12px; margin-top:16px; font-size:9pt; color:#92400e; text-align:center; }
  `,
    opts,
  );
}

function totalsQuotation(data: RenderData, opts: RenderOptions): string {
  const d = data.document;
  const symbol = opts.currencySymbol || "PKR";
  return `
    <tr><td>${esc(docLabel("subtotal", data, opts))}</td><td class="right">${fmt(d.subtotal, symbol)}</td></tr>
    ${d.discount > 0 ? `<tr><td>${esc(docLabel("discount", data, opts))}</td><td class="right" style="color:#dc2626;">-${fmt(d.discount, symbol)}</td></tr>` : ""}
    ${d.tax > 0 ? `<tr><td>${opts.taxName}</td><td class="right">${fmt(d.tax, symbol)}</td></tr>` : ""}
    <tr class="total-row"><td><strong>${esc(docLabel("total", data, opts))}</strong></td><td class="right"><strong>${fmt(d.total, symbol)}</strong></td></tr>
  `;
}
