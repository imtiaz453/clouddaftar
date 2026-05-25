import type { RenderData, RenderOptions } from "@/lib/template-registry";
import { docLabel } from "@/lib/document-labels";

export function esc(str: string | number | null | undefined): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmt(amount: number, symbol = "PKR"): string {
  return `${symbol} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fd(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function fds(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function companyInfo(data: RenderData, opts: RenderOptions): string {
  const c = data.company;
  if (!opts.showHeader) return "";
  const logo =
    opts.showLogo && c.logo
      ? `<img src="${esc(c.logo)}" alt="Logo" class="logo" style="max-height:60px;margin-bottom:8px;object-fit:contain;" />`
      : "";
  return `
    ${logo}
    ${!logo && opts.showLogo ? `<h1 class="company-name">${esc(c.name)}</h1>` : logo ? `<h1 class="company-name" style="margin-top:4px;">${esc(c.name)}</h1>` : ""}
    ${c.address ? `<p>${esc(c.address)}</p>` : ""}
    ${c.city ? `<p>${esc(c.city)}${c.state ? ", " + esc(c.state) : ""}${c.zipCode ? " - " + esc(c.zipCode) : ""}</p>` : ""}
    ${c.country ? `<p>${esc(c.country)}</p>` : ""}
    ${c.phone ? `<p>Tel: ${esc(c.phone)}</p>` : ""}
    ${c.email ? `<p>${esc(c.email)}</p>` : ""}
    ${c.taxId ? `<p>${esc(opts.taxName)}: ${esc(c.taxId)}</p>` : ""}
  `;
}

export function customerInfo(data: RenderData): string {
  const cust = data.customer;
  if (!cust) return `<p>${esc(docLabel("walkInCustomer", data))}</p>`;
  return `
    <p><strong>${esc(cust.name)}</strong></p>
    ${cust.phone ? `<p>${esc(cust.phone)}</p>` : ""}
    ${cust.email ? `<p>${esc(cust.email)}</p>` : ""}
    ${cust.address ? `<p>${esc(cust.address)}</p>` : ""}
  `;
}

export function operationalInfo(data: RenderData): string {
  const d = data.document;
  const rows = [
    d.createdByName ? `Created by: ${d.createdByName}` : null,
    d.branchName ? `Branch: ${d.branchName}` : null,
    d.warehouseName ? `Warehouse: ${d.warehouseName}` : null,
  ].filter(Boolean);
  if (rows.length === 0) return "";
  return rows
    .map((row) => `<p style="font-size:9pt;color:#64748b;margin-top:4px;">${esc(row)}</p>`)
    .join("");
}

export function itemsTable(items: RenderData["items"], opts: RenderOptions): string {
  const symbol = opts.currencySymbol || "PKR";
  return items
    .map(
      (item, i) => `
    <tr class="${i % 2 === 0 ? "even" : "odd"}">
      <td>
        ${esc(item.name)}
        ${item.sku ? `<br/><span class="item-sku">SKU: ${esc(item.sku)}</span>` : ""}
        ${item.discount > 0 ? `<br/><span class="item-discount">${esc(docLabel("discount", undefined, opts))}: -${fmt(item.discount, symbol)}</span>` : ""}
      </td>
      <td class="right">${item.quantity}${item.unit ? " " + esc(item.unit) : ""}</td>
      <td class="right">${fmt(item.price, symbol)}</td>
      <td class="right">${fmt(item.subtotal, symbol)}</td>
    </tr>
  `,
    )
    .join("");
}

export function itemsHeader(data: RenderData, opts: RenderOptions, itemLabel = "item"): string {
  return `<thead><tr><th style="width:44%;">${esc(itemLabel === "description" ? `${docLabel("item", data, opts)} / ${docLabel("description", data, opts)}` : docLabel("item", data, opts))}</th><th class="right">${esc(docLabel("qty", data, opts))}</th><th class="right">${esc(docLabel("price", data, opts))}</th><th class="right">${esc(docLabel("total", data, opts))}</th></tr></thead>`;
}

export function itemsTableCompact(items: RenderData["items"], opts?: RenderOptions): string {
  const symbol = opts?.currencySymbol || "PKR";
  return items
    .map(
      (item) => `
    <tr>
      <td colspan="4">
        <div class="item-name">${esc(item.name)}${item.sku ? ` (${esc(item.sku)})` : ""}</div>
        <div class="item-detail">${item.quantity} x ${fmt(item.price, symbol)}${item.discount > 0 ? ` - disc ${fmt(item.discount, symbol)}` : ""}</div>
      </td>
      <td class="right">${fmt(item.subtotal, symbol)}</td>
    </tr>
  `,
    )
    .join("");
}

export function totalsBlock(data: RenderData, opts: RenderOptions): string {
  const d = data.document;
  const symbol = opts.currencySymbol || "PKR";
  return `
    <tr><td>${esc(docLabel("subtotal", data, opts))}</td><td class="right">${fmt(d.subtotal, symbol)}</td></tr>
    ${d.discount > 0 ? `<tr><td>${esc(docLabel("discount", data, opts))}</td><td class="right" style="color:#dc2626;">-${fmt(d.discount, symbol)}</td></tr>` : ""}
    ${d.tax > 0 ? `<tr><td>${opts.taxName}</td><td class="right">${fmt(d.tax, symbol)}</td></tr>` : ""}
    <tr class="total-row"><td><strong>${esc(docLabel("total", data, opts))}</strong></td><td class="right"><strong>${fmt(d.total, symbol)}</strong></td></tr>
    <tr><td>${esc(docLabel("paid", data, opts))}</td><td class="right">${fmt(d.paid, symbol)}</td></tr>
    ${d.due > 0 ? `<tr class="due-row"><td><strong>${esc(docLabel("amountDue", data, opts))}</strong></td><td class="right"><strong>${fmt(d.due, symbol)}</strong></td></tr>` : ""}
  `;
}

export function footerBlock(data: RenderData, opts: RenderOptions): string {
  if (!opts.showFooter) return "";
  const text = opts.footerText || "Thank you for your business!";
  return `<p>${esc(text)}</p>${operationalInfo(data)}`;
}

export function notesBlock(data: RenderData): string {
  const d = data.document;
  if (!d.notes) return "";
  return `
    <div class="notes-box">
      <p class="label">${esc(docLabel("notes", data))}</p>
      <p>${esc(d.notes)}</p>
    </div>
  `;
}

export function termsBlock(data: RenderData): string {
  const d = data.document;
  if (!d.terms) return "";
  return `
    <div class="notes-box" style="margin-top:12px;">
      <p class="label">${esc(docLabel("terms", data))}</p>
      <p style="white-space:pre-wrap;">${esc(d.terms)}</p>
    </div>
  `;
}

export function paymentStatusBadge(paymentStatus: string, primaryColor: string): string {
  if (paymentStatus === "PAID") return `<span class="badge badge-paid">PAID</span>`;
  if (paymentStatus === "PARTIALLY_PAID")
    return `<span class="badge badge-partial">PARTIALLY PAID</span>`;
  if (paymentStatus === "UNPAID") return `<span class="badge badge-unpaid">UNPAID</span>`;
  return "";
}

export function statusWatermark(status: string): string {
  if (status === "DRAFT") return `<div class="watermark">DRAFT</div>`;
  if (status === "REFUNDED" || status === "CANCELLED")
    return `<div class="watermark">${status}</div>`;
  return "";
}

export function signatureBlock(opts: RenderOptions): string {
  if (!opts.showSignature) return "";
  return `
    <div class="signature-row">
      <div class="signature-box">
        <div class="signature-line"></div>
        <p>${esc(docLabel("authorizedSignature", undefined, opts))}</p>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <p>${esc(docLabel("customerSignature", undefined, opts))}</p>
      </div>
    </div>
  `;
}

export function barcodeBlock(docNumber: string, opts: RenderOptions): string {
  if (!opts.showBarcode) return "";
  return `<div class="barcode-row"><svg class="barcode-svg" data-barcode="${esc(docNumber)}"></svg><p class="barcode-text">${esc(docNumber)}</p></div>`;
}

function isTaxInvoiceDocument(data: RenderData): boolean {
  return ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(data.document.status || "");
}

export function qrBlock(data: RenderData, opts: RenderOptions): string {
  if (!opts.showQR) return "";
  if (!isTaxInvoiceDocument(data)) return "";
  const payload = data.taxInfo?.qrPayload;
  if (!payload) return "";
  const qrUrl = `/api/qr?payload=${encodeURIComponent(payload)}`;
  const mode = opts.taxComplianceMode || "NONE";
  const status = opts.taxComplianceStatus;
  const statusLabel =
    status === "VERIFIED"
      ? "Tax Verified"
      : status === "FAILED"
        ? "Verification Failed"
        : status === "NOT_VERIFIED"
          ? "Not Verified"
          : "";
  return `
    <div class="qr-row">
      <div class="qr-container">
        <img src="${qrUrl}" alt="QR Code" class="qr-img" style="width:100px;height:100px;" />
        ${mode !== "NONE" ? `<p class="qr-label">${mode === "FBR" ? "FBR Invoice" : "TAX INVOICE"}</p>` : ""}
        ${statusLabel ? `<p class="qr-status ${status === "VERIFIED" ? "verified" : status === "FAILED" ? "failed" : "pending"}">${statusLabel}</p>` : ""}
        ${opts.fbrInvoiceNumber ? `<p class="qr-irn">IRN: ${esc(opts.fbrInvoiceNumber)}</p>` : ""}
      </div>
    </div>
  `;
}

export function complianceBadge(data: RenderData, opts: RenderOptions): string {
  if (!isTaxInvoiceDocument(data)) return "";
  const mode = data.document.taxComplianceMode;
  const status = data.document.taxComplianceStatus;
  if (!mode || mode === "NONE") return "";
  const label = mode === "FBR" ? "FBR" : "ZATCA";
  const statusClass =
    status === "VERIFIED" ? "badge-paid" : status === "FAILED" ? "badge-unpaid" : "badge-partial";
  const statusText =
    status === "VERIFIED"
      ? "Verified"
      : status === "FAILED"
        ? "Failed"
        : status === "NOT_VERIFIED"
          ? "Not Verified"
          : "Pending";
  return `<span class="badge ${statusClass}" style="font-size:9px;">${label} ${statusText}</span>`;
}

export function wrapHtml(content: string, styles: string, opts: RenderOptions): string {
  const isThermal = opts.paperSize === "THERMAL_58" || opts.paperSize === "THERMAL_80";
  const thermalWidth = opts.paperSize === "THERMAL_58" ? "58mm" : "80mm";
  const thermalPageHeight = opts.paperSize === "THERMAL_58" ? "220mm" : "260mm";
  const pageSize = isThermal ? `${thermalWidth} ${thermalPageHeight}` : "A4";
  const pageMargin =
    opts.paperSize === "THERMAL_58" ? "3mm" : opts.paperSize === "THERMAL_80" ? "5mm" : "15mm";
  const fontSizeMap: Record<string, string> = { small: "9pt", normal: "10pt", large: "11pt" };
  const bodyFontSize = isThermal ? "10px" : fontSizeMap[opts.fontSize] || "10pt";
  const thermalPrintCss = isThermal
    ? `
    html, body {
      width: ${thermalWidth};
      max-width: ${thermalWidth};
      min-width: ${thermalWidth};
      margin: 0 auto;
      background: #fff;
    }
    body {
      overflow-x: hidden;
      color: #000;
    }
    @media print {
      html, body {
        width: ${thermalWidth} !important;
        max-width: ${thermalWidth} !important;
        min-width: ${thermalWidth} !important;
        margin: 0 !important;
        background: #fff !important;
      }
    }
  `
    : "";
  const a4Decoration = isThermal
    ? ""
    : `
    body {
      background:
        linear-gradient(135deg, rgba(15, 23, 42, 0.025), transparent 34%),
        linear-gradient(315deg, rgba(59, 130, 246, 0.035), transparent 32%),
        #fff;
      position: relative;
    }
    body::before {
      content: "";
      position: fixed;
      top: -18mm;
      right: -24mm;
      width: 96mm;
      height: 96mm;
      background: linear-gradient(135deg, ${opts.primaryColor}, ${opts.accentColor});
      opacity: 0.08;
      clip-path: polygon(30% 0, 100% 0, 100% 70%);
      pointer-events: none;
      z-index: 0;
    }
    body::after {
      content: "";
      position: fixed;
      left: -20mm;
      bottom: -24mm;
      width: 92mm;
      height: 92mm;
      border: 1.5mm solid ${opts.accentColor};
      opacity: 0.06;
      transform: rotate(18deg);
      pointer-events: none;
      z-index: 0;
    }
    .document-canvas {
      position: relative;
      z-index: 1;
      min-height: calc(297mm - ${pageMargin} - ${pageMargin});
    }
    .document-canvas::before {
      content: "";
      position: absolute;
      top: -10mm;
      left: 0;
      width: 42mm;
      height: 2mm;
      background: ${opts.accentColor};
      opacity: 0.8;
    }
    .items {
      box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
    }
    .summary {
      background: rgba(248, 250, 252, 0.8);
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
    }
    .notes-box {
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
    }
  `;

  const autoPrintScript =
    typeof opts.advancedDesign === "object" && opts.advancedDesign?.autoPrint === false
      ? ""
      : "<script>window.print();</script>";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(opts.paperSize === "A4" ? (opts.showHeader ? "Document" : "Receipt") : "Receipt")}</title>
  <style>
    @page { size: ${pageSize}; margin: ${pageMargin}; }
    @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: ${bodyFontSize}; color: #1e293b; line-height: 1.5; }
    ${thermalPrintCss}
    ${a4Decoration}
    ${styles}
  </style>
</head>
<body>
  ${isThermal ? content : `<main class="document-canvas">${content}</main>`}
  <div class="no-print" style="text-align:center;margin-top:20px;padding:20px;">
    <button onclick="window.print()" style="padding:10px 30px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1);">Print / Save PDF</button>
    <button onclick="window.close()" style="padding:10px 30px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff;margin-left:10px;">Close</button>
  </div>
  ${autoPrintScript}
</body>
</html>`;
}
