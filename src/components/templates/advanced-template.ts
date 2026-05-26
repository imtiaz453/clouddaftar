import type { RenderData, RenderOptions } from "@/lib/template-registry";
import { formatCurrency, formatDateShort } from "@/lib/template-registry";
import QRCode from "qrcode";

export const DEFAULT_ADVANCED_DESIGN = {
  documentTitle: "INVOICE",
  labels: {
    invoice: "Invoice",
    quotation: "Quotation",
    billTo: "Bill To",
    preparedFor: "Prepared For",
    number: "Number",
    date: "Date",
    dueDate: "Due Date",
    salesPerson: "Sales Person",
    payment: "Payment",
    item: "Item",
    sku: "SKU",
    qty: "Qty",
    unit: "Unit",
    price: "Price",
    discount: "Discount",
    tax: "Tax",
    total: "Total",
    lineTotal: "Line Total",
    summaryTotal: "Grand Total",
    subtotal: "Subtotal",
    paid: "Paid",
    due: "Due",
    notes: "Notes",
    terms: "Terms and Conditions",
    signature: "Authorized Signature",
    customerSignature: "Customer Signature",
  },
  visibility: {
    companyAddress: true,
    customerPhone: true,
    customerEmail: true,
    salesPerson: true,
    paymentMethod: true,
    sku: true,
    unit: true,
    discount: true,
    tax: true,
    notes: true,
    terms: true,
    signature: true,
    customerSignature: true,
    pageNumbers: true,
    qrCode: true,
  },
  layout: {
    headerStyle: "split",
    logoPosition: "left",
    logoWidth: 96,
    logoHeight: 64,
    topPadding: 28,
    sidePadding: 32,
    sectionGap: 18,
    borderRadius: 6,
    qrPosition: "bottom-left",
    qrSize: 96,
  },
  table: {
    headerFill: true,
    zebra: true,
    verticalLines: false,
    rowLines: true,
    compact: false,
    lineWidth: 1,
  },
  text: {
    fontFamily: "Arial, sans-serif",
    baseSize: 12,
    titleSize: 28,
    lineHeight: 1.45,
  },
  content: {
    headerText: "",
    footerText: "Thank you for your business.",
    terms:
      "Payment is due according to the agreed terms. Goods remain company property until fully paid.",
    notes: "",
  },
};

export function normalizeAdvancedDesign(value?: Record<string, any> | null) {
  const incomingLabels = value?.labels || {};
  const legacyTotalLabel = incomingLabels.total || DEFAULT_ADVANCED_DESIGN.labels.total;
  return {
    ...DEFAULT_ADVANCED_DESIGN,
    ...(value || {}),
    labels: {
      ...DEFAULT_ADVANCED_DESIGN.labels,
      ...incomingLabels,
      lineTotal: incomingLabels.lineTotal || legacyTotalLabel,
      summaryTotal: incomingLabels.summaryTotal || legacyTotalLabel,
    },
    visibility: { ...DEFAULT_ADVANCED_DESIGN.visibility, ...(value?.visibility || {}) },
    layout: { ...DEFAULT_ADVANCED_DESIGN.layout, ...(value?.layout || {}) },
    table: { ...DEFAULT_ADVANCED_DESIGN.table, ...(value?.table || {}) },
    text: { ...DEFAULT_ADVANCED_DESIGN.text, ...(value?.text || {}) },
    content: { ...DEFAULT_ADVANCED_DESIGN.content, ...(value?.content || {}) },
  };
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function base64(value: string) {
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(value)));
  return Buffer.from(value).toString("base64");
}

function buildQrPayload(data: RenderData) {
  return (
    data.taxInfo?.qrPayload ||
    [
      data.company.name,
      data.company.taxId,
      data.document.number,
      new Date(data.document.date).toISOString(),
      data.document.total,
      data.document.tax,
    ]
      .filter((value) => value !== null && value !== undefined && value !== "")
      .join("|")
  );
}

function isTaxInvoiceDocument(data: RenderData): boolean {
  return ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(data.document.status || "");
}

function qrDataUrl(payload: string) {
  if (!payload) return "";
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
    const moduleCount = qr.modules.size;
    const cell = 4;
    const quiet = 4;
    const size = (moduleCount + quiet * 2) * cell;
    const rects: string[] = [];
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (!qr.modules.get(row, col)) continue;
        rects.push(
          `<rect x="${(col + quiet) * cell}" y="${(row + quiet) * cell}" width="${cell}" height="${cell}"/>`,
        );
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects.join("")}</g></svg>`;
    return `data:image/svg+xml;base64,${base64(svg)}`;
  } catch {
    return "";
  }
}

export function renderAdvancedDocument(
  data: RenderData,
  opts: Partial<RenderOptions> = {},
  advancedDesign?: Record<string, any> | null,
) {
  const d = normalizeAdvancedDesign(advancedDesign || opts.advancedDesign);
  const primary = opts.primaryColor || "#0f172a";
  const accent = opts.accentColor || "#3b82f6";
  const currency = opts.currencySymbol || "PKR";
  const isQuotation = data.type === "quotation";
  const title = d.documentTitle || (isQuotation ? d.labels.quotation : d.labels.invoice);
  const pad = Number(d.layout.sidePadding || 32);
  const border = "#d9e0ea";
  const muted = "#64748b";
  const shouldShowQr = Boolean(opts.showQR && d.visibility.qrCode && isTaxInvoiceDocument(data));
  const qrUrl = shouldShowQr ? qrDataUrl(buildQrPayload(data)) : "";
  const headerCellStyle = d.table.headerFill
    ? `background:${primary};color:#fff;`
    : `background:#fff;color:${primary};border-top:${d.table.lineWidth}px solid ${primary};border-bottom:${d.table.lineWidth}px solid ${primary};`;
  const columns = [
    { key: "item", label: d.labels.item, show: true, align: "left" },
    { key: "sku", label: d.labels.sku, show: d.visibility.sku, align: "left" },
    { key: "qty", label: d.labels.qty, show: true, align: "right" },
    { key: "unit", label: d.labels.unit, show: d.visibility.unit, align: "left" },
    { key: "price", label: d.labels.price, show: true, align: "right" },
    { key: "discount", label: d.labels.discount, show: d.visibility.discount, align: "right" },
    { key: "tax", label: d.labels.tax, show: d.visibility.tax, align: "right" },
    { key: "total", label: d.labels.lineTotal, show: true, align: "right" },
  ].filter((col) => col.show);

  const tableBorder = d.table.verticalLines
    ? `border:${d.table.lineWidth}px solid ${border};`
    : d.table.rowLines
      ? `border-bottom:${d.table.lineWidth}px solid ${border};`
      : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} ${esc(data.document.number)}</title>
  <style>
    @page { size: ${opts.paperSize === "A4" ? "A4" : "auto"}; margin: 0; }
    * { box-sizing: border-box; }
    body { margin:0; background:#eef2f7; color:#172033; font-family:${d.text.fontFamily}; font-size:${Number(d.text.baseSize)}px; line-height:${Number(d.text.lineHeight)}; }
    .page { width:210mm; min-height:297mm; margin:0 auto; background:#fff; padding:${Number(d.layout.topPadding)}px ${pad}px; }
    .top-line { height:7px; background:${primary}; margin:${-Number(d.layout.topPadding)}px ${-pad}px 22px; }
    .header { display:flex; justify-content:space-between; gap:28px; align-items:flex-start; }
    .brand { display:flex; gap:14px; align-items:flex-start; ${d.layout.logoPosition === "right" ? "flex-direction:row-reverse;text-align:right;" : ""} }
    .logo { width:${Number(d.layout.logoWidth)}px; height:${Number(d.layout.logoHeight)}px; object-fit:contain; border:1px solid ${border}; padding:6px; }
    .logo-box { width:${Number(d.layout.logoWidth)}px; height:${Number(d.layout.logoHeight)}px; display:flex; align-items:center; justify-content:center; border:1px solid ${border}; color:${muted}; font-size:11px; }
    h1 { margin:0; color:${primary}; font-size:${Number(d.text.titleSize)}px; letter-spacing:0; }
    .company-name { margin:0 0 5px; font-size:18px; font-weight:700; color:${primary}; }
    .muted { color:${muted}; }
    .doc-box { text-align:right; border-left:4px solid ${accent}; padding-left:18px; min-width:190px; }
    .header-note { margin-top:16px; padding:10px 12px; border:1px solid ${border}; border-left:4px solid ${accent}; border-radius:${Number(d.layout.borderRadius)}px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:${Number(d.layout.sectionGap)}px; margin-top:24px; }
    .panel { border:1px solid ${border}; border-radius:${Number(d.layout.borderRadius)}px; padding:14px; min-height:116px; }
    .panel-title { color:${muted}; font-size:11px; text-transform:uppercase; font-weight:700; margin-bottom:8px; }
    .details { display:grid; grid-template-columns:auto 1fr; gap:5px 12px; }
    .details dt { color:${muted}; }
    .details dd { margin:0; text-align:right; font-weight:600; }
    table { width:100%; border-collapse:collapse; margin-top:24px; }
    th { ${headerCellStyle} padding:${d.table.compact ? 7 : 10}px 9px; font-size:11px; text-transform:uppercase; }
    td { padding:${d.table.compact ? 7 : 10}px 9px; vertical-align:top; ${tableBorder} }
    tbody tr:nth-child(even) td { background:${d.table.zebra ? "#f8fafc" : "#fff"}; }
    .right { text-align:right; }
    .totals { margin-left:auto; margin-top:18px; width:310px; border:1px solid ${border}; border-radius:${Number(d.layout.borderRadius)}px; overflow:hidden; }
    .after-table { display:flex; align-items:flex-start; gap:18px; margin-top:18px; ${d.layout.qrPosition === "bottom-right" ? "flex-direction:row-reverse;" : ""} }
    .qr-box { width:${Number(d.layout.qrSize)}px; min-width:${Number(d.layout.qrSize)}px; text-align:center; border:1px solid ${border}; border-radius:${Number(d.layout.borderRadius)}px; padding:8px; }
    .qr-box img { width:100%; height:auto; display:block; }
    .qr-label { margin-top:5px; color:${muted}; font-size:10px; }
    .total-row { display:flex; justify-content:space-between; gap:20px; padding:8px 12px; border-bottom:1px solid ${border}; }
    .total-row:last-child { border-bottom:0; background:${primary}; color:#fff; font-weight:700; }
    .notes { margin-top:22px; display:grid; grid-template-columns:1fr 1fr; gap:${Number(d.layout.sectionGap)}px; }
    .signatures { margin-top:42px; display:grid; grid-template-columns:1fr 1fr; gap:40px; }
    .sig-line { border-top:1px solid ${primary}; padding-top:8px; text-align:center; color:${muted}; }
    footer { margin-top:28px; padding-top:12px; border-top:1px solid ${border}; display:flex; justify-content:space-between; gap:20px; color:${muted}; font-size:11px; }
    @media print { body { background:#fff; } .page { margin:0; width:auto; min-height:auto; } }
  </style>
</head>
<body>
  <main class="page">
    <div class="top-line"></div>
    <section class="header">
      <div class="brand">
        ${
          opts.showLogo
            ? data.company.logo
              ? `<img class="logo" src="${esc(data.company.logo)}" alt="Logo" />`
              : `<div class="logo-box">LOGO</div>`
            : ""
        }
        <div>
          <p class="company-name">${esc(data.company.name)}</p>
          ${
            d.visibility.companyAddress
              ? `<div class="muted">${[
                  data.company.address,
                  [data.company.city, data.company.state, data.company.zipCode]
                    .filter(Boolean)
                    .join(", "),
                  data.company.country,
                ]
                  .filter(Boolean)
                  .map(esc)
                  .join("<br />")}</div>`
              : ""
          }
          <div class="muted">${[data.company.phone, data.company.email, data.company.website].filter(Boolean).map(esc).join(" | ")}</div>
          ${data.company.taxId ? `<div class="muted">${esc(opts.taxName || d.labels.tax)}: ${esc(data.company.taxId)}</div>` : ""}
        </div>
      </div>
      <div class="doc-box">
        <h1>${esc(title)}</h1>
        <div class="muted">${esc(d.labels.number)}: <strong>${esc(data.document.number)}</strong></div>
        <div class="muted">${esc(d.labels.date)}: ${esc(formatDateShort(data.document.date))}</div>
        ${data.document.dueDate ? `<div class="muted">${esc(d.labels.dueDate)}: ${esc(formatDateShort(data.document.dueDate))}</div>` : ""}
      </div>
    </section>
    ${d.content.headerText || opts.headerText ? `<div class="header-note">${esc(d.content.headerText || opts.headerText)}</div>` : ""}

    <section class="grid">
      <div class="panel">
        <div class="panel-title">${esc(isQuotation ? d.labels.preparedFor : d.labels.billTo)}</div>
        <strong>${esc(data.customer?.name || "Walk-in Customer")}</strong>
        ${d.visibility.customerPhone && data.customer?.phone ? `<div class="muted">${esc(data.customer.phone)}</div>` : ""}
        ${d.visibility.customerEmail && data.customer?.email ? `<div class="muted">${esc(data.customer.email)}</div>` : ""}
        ${data.customer?.address ? `<div class="muted">${esc(data.customer.address)}</div>` : ""}
      </div>
      <div class="panel">
        <div class="panel-title">${esc(title)} Details</div>
        <dl class="details">
          <dt>${esc(d.labels.number)}</dt><dd>${esc(data.document.number)}</dd>
          <dt>${esc(d.labels.date)}</dt><dd>${esc(formatDateShort(data.document.date))}</dd>
          ${d.visibility.salesPerson ? `<dt>${esc(d.labels.salesPerson)}</dt><dd>${esc(data.document.createdByName || "-")}</dd>` : ""}
          ${d.visibility.paymentMethod ? `<dt>${esc(d.labels.payment)}</dt><dd>${esc(data.document.paymentMethod || "-")}</dd>` : ""}
        </dl>
      </div>
    </section>

    <table>
      <thead><tr>${columns.map((col) => `<th class="${col.align === "right" ? "right" : ""}">${esc(col.label)}</th>`).join("")}</tr></thead>
      <tbody>
        ${data.items
          .map((item) => {
            const cells: Record<string, string> = {
              item: `<strong>${esc(item.name)}</strong>${item.description ? `<br/><span style="font-size:11px;color:#666;">${esc(item.description)}</span>` : ""}`,
              sku: esc(item.sku || "-"),
              qty: esc(item.quantity),
              unit: esc(item.unit || "-"),
              price: esc(formatCurrency(item.price, currency)),
              discount: esc(formatCurrency(item.discount || 0, currency)),
              tax: esc(`${item.tax || 0}%`),
              total: esc(formatCurrency(item.subtotal, currency)),
            };
            return `<tr>${columns
              .map(
                (col) =>
                  `<td class="${col.align === "right" ? "right" : ""}">${cells[col.key]}</td>`,
              )
              .join("")}</tr>`;
          })
          .join("")}
      </tbody>
    </table>

    <section class="after-table">
      ${qrUrl ? `<div class="qr-box"><img src="${qrUrl}" alt="QR Code" /><div class="qr-label">${esc(data.document.taxComplianceMode === "FBR" ? "FBR Invoice" : data.document.taxComplianceMode === "ZATCA" ? "TAX INVOICE" : data.document.taxComplianceMode || "QR Code")}</div></div>` : "<div></div>"}
      <div class="totals">
        <div class="total-row"><span>${esc(d.labels.subtotal)}</span><strong>${esc(formatCurrency(data.document.subtotal, currency))}</strong></div>
        <div class="total-row"><span>${esc(d.labels.discount)}</span><strong>${esc(formatCurrency(data.document.discount, currency))}</strong></div>
        <div class="total-row"><span>${esc(opts.taxName || d.labels.tax)}</span><strong>${esc(formatCurrency(data.document.tax, currency))}</strong></div>
        ${data.type === "invoice" ? `<div class="total-row"><span>${esc(d.labels.paid)}</span><strong>${esc(formatCurrency(data.document.paid, currency))}</strong></div>` : ""}
        ${data.type === "invoice" ? `<div class="total-row"><span>${esc(d.labels.due)}</span><strong>${esc(formatCurrency(data.document.due, currency))}</strong></div>` : ""}
        <div class="total-row"><span>${esc(d.labels.summaryTotal)}</span><strong>${esc(formatCurrency(data.document.total, currency))}</strong></div>
      </div>
    </section>

    <section class="notes">
      ${d.visibility.notes ? `<div class="panel"><div class="panel-title">${esc(d.labels.notes)}</div>${esc(d.content.notes || data.document.notes || "")}</div>` : ""}
      ${d.visibility.terms ? `<div class="panel"><div class="panel-title">${esc(d.labels.terms)}</div><div style="white-space:pre-wrap;">${esc(data.document.terms || d.content.terms || "")}</div></div>` : ""}
    </section>

    ${
      d.visibility.signature || d.visibility.customerSignature
        ? `<section class="signatures">
            ${d.visibility.signature ? `<div class="sig-line">${esc(d.labels.signature)}</div>` : "<div></div>"}
            ${d.visibility.customerSignature ? `<div class="sig-line">${esc(d.labels.customerSignature)}</div>` : "<div></div>"}
          </section>`
        : ""
    }

    <footer>
      <span>${esc(d.content.footerText || opts.footerText || "")}</span>
      ${d.visibility.pageNumbers ? "<span>Page 1 of 1</span>" : ""}
    </footer>
  </main>
</body>
</html>`;
}

export const ADVANCED_SAMPLE_DATA: RenderData = {
  company: {
    name: "Cloud Daftar Trading",
    logo: null,
    address: "Office 12, Business Street",
    city: "Riyadh",
    state: "Riyadh",
    zipCode: "12211",
    country: "Saudi Arabia",
    phone: "+966 55 123 4567",
    email: "sales@clouddaftar.com",
    taxId: "300000000000003",
    website: "clouddaftar.com",
  },
  customer: {
    name: "Al Noor Customer",
    phone: "+966 50 765 4321",
    email: "buyer@example.com",
    address: "Customer Avenue, Riyadh",
  },
  document: {
    number: "INV-00001",
    date: new Date(),
    dueDate: new Date(Date.now() + 15 * 86_400_000),
    status: "COMPLETED",
    notes: "Deliver to main warehouse gate.",
    terms: "Payment due within 15 days.",
    createdByName: "Admin User",
    paymentMethod: "BANK_TRANSFER",
    subtotal: 50000,
    discount: 2500,
    tax: 7125,
    total: 54625,
    paid: 30000,
    due: 24625,
    taxComplianceMode: "ZATCA",
    taxComplianceStatus: "READY",
  },
  taxInfo: {
    qrPayload: "Cloud Daftar Trading|300000000000003|INV-00001|54625.00|7125.00",
  },
  items: [
    {
      name: "Product Alpha",
      sku: "SKU-001",
      quantity: 10,
      price: 2000,
      discount: 0,
      tax: 15,
      subtotal: 20000,
      unit: "pcs",
    },
    {
      name: "Product Beta",
      sku: "SKU-002",
      quantity: 5,
      price: 3500,
      discount: 500,
      tax: 15,
      subtotal: 17500,
      unit: "pcs",
    },
    {
      name: "Service Gamma",
      sku: null,
      quantity: 1,
      price: 15000,
      discount: 2000,
      tax: 15,
      subtotal: 15000,
      unit: null,
    },
  ],
  type: "invoice",
};
