import type { RenderData, RenderOptions } from "@/lib/template-registry";
import {
  esc,
  fmt,
  fds,
  itemsTableCompact,
  totalsBlock,
  qrBlock,
  complianceBadge,
  paymentStatusBadge,
  operationalInfo,
} from "./shared";
import { wrapHtml } from "./shared";
import { docLabel } from "@/lib/document-labels";

function thermalStyles(
  paperSize: string,
  isCompact: boolean,
  isPos: boolean,
  isMinimal: boolean,
): string {
  const fontSize =
    paperSize === "THERMAL_58" ? (isMinimal ? "8px" : "9px") : isPos ? "10px" : "9px";
  return `
    body { font-family: 'Courier New', monospace; font-size: ${fontSize}; color: #000; line-height: 1.3; width: 100%; }
    .header { text-align: center; margin-bottom: 6px; }
    .header h1 { font-size: ${paperSize === "THERMAL_58" ? "12px" : "14px"}; font-weight: bold; margin-bottom: 3px; }
    .header p { font-size: ${paperSize === "THERMAL_58" ? "7px" : "8px"}; color: #555; }
    .header .logo { max-height: ${paperSize === "THERMAL_58" ? "40px" : "50px"}; margin-bottom: 4px; object-fit: contain; }
    .divider { border-top: 1px dashed #999; margin: 4px 0; }
    .divider-solid { border-top: 1px solid #000; margin: 4px 0; }
    .info { margin-bottom: 4px; }
    .info table { width: 100%; font-size: ${paperSize === "THERMAL_58" ? "8px" : "9px"}; }
    .info td { padding: 1px 0; }
    .info td:last-child { text-align: right; }
    ${
      isPos
        ? `
    .items { width:100%; }
    .items .item-row { border-bottom:1px dashed #ddd; padding:4px 0; margin-bottom:4px; }
    .items .item-name { font-weight:bold; font-size:${paperSize === "THERMAL_58" ? "9px" : "10px"}; }
    .items .item-detail { font-size:${paperSize === "THERMAL_58" ? "8px" : "9px"}; color:#555; }
    .items .item-total { text-align:right; font-weight:bold; }
    `
        : `
    .items { width:100%; border-collapse:collapse; margin-bottom:4px; }
    .items th { border-bottom:1px solid #000; padding:2px; text-align:left; font-size:${paperSize === "THERMAL_58" ? "8px" : "9px"}; }
    .items td { padding:2px; font-size:${paperSize === "THERMAL_58" ? "8px" : "9px"}; vertical-align:top; }
    .items .right { text-align:right; }
    `
    }
    .summary { width:100%; margin-bottom:4px; }
    .summary td { padding:1px 0; font-size:${paperSize === "THERMAL_58" ? "8px" : "9px"}; }
    .summary .right { text-align:right; }
    .summary .total-row td { font-weight:bold; font-size:${paperSize === "THERMAL_58" ? "10px" : "11px"}; border-top:1px solid #000; padding-top:3px; }
    .summary .due-row td { font-weight:bold; color:#dc2626; }
    .footer { text-align:center; font-size:${paperSize === "THERMAL_58" ? "7px" : "8px"}; color:#999; margin-top:6px; }
    .badge { text-align:center; margin-bottom:4px; }
    .badge span { background:#000; color:#fff; padding:1px 6px; font-size:${paperSize === "THERMAL_58" ? "8px" : "9px"}; letter-spacing:1px; }
    .barcode-row { text-align:center; margin-top:6px; }
    .barcode-text { font-size:7px; font-family:monospace; margin-top:2px; }
    .notes { font-size:${paperSize === "THERMAL_58" ? "7px" : "8px"}; color:#666; margin-top:4px; }
    ${
      isMinimal
        ? `
    .header h1 { font-size:${paperSize === "THERMAL_58" ? "10px" : "12px"}; }
    .header p, .info td, .items td, .items th, .summary td { font-size:${paperSize === "THERMAL_58" ? "7px" : "8px"}; }
    .summary .total-row td { font-size:${paperSize === "THERMAL_58" ? "9px" : "10px"}; }
    `
        : ""
    }
  `;
}

function renderCompact(
  items: RenderData["items"],
  data: RenderData,
  opts: RenderOptions,
  is58: boolean,
): string {
  const d = data.document;
  const symbol = opts.currencySymbol || "PKR";
  const imgTag =
    opts.showLogo && data.company.logo
      ? `<img src="${esc(data.company.logo)}" alt="Logo" class="logo" />`
      : "";
  const content = `
    <div class="header">
      ${imgTag}
      <h1>${esc(data.company.name)}</h1>
      ${data.company.address ? `<p>${esc(data.company.address)}</p>` : ""}
      ${data.company.city ? `<p>${esc(data.company.city)}${data.company.state ? ", " + esc(data.company.state) : ""}</p>` : ""}
      ${data.company.country ? `<p>${esc(data.company.country)}</p>` : ""}
      ${data.company.phone ? `<p>Tel: ${esc(data.company.phone)}</p>` : ""}
      ${data.company.email ? `<p>${esc(data.company.email)}</p>` : ""}
      ${data.company.taxId ? `<p>${esc(opts.taxName)}: ${esc(data.company.taxId)}</p>` : ""}
    </div>
    <div class="divider"></div>
    <div class="badge"><span>${esc(docLabel("invoice", data, opts).toUpperCase())}</span></div>
    <div style="text-align:center;margin-bottom:4px;">${paymentStatusBadge(d.status, "#000")} ${complianceBadge(data, opts)}</div>
    <div class="info">
      <table>
        <tr><td>${esc(docLabel("invoice", data, opts))} #</td><td class="right">${esc(d.number)}</td></tr>
        <tr><td>${esc(docLabel("date", data, opts))}</td><td class="right">${fds(d.date)}</td></tr>
        ${d.dueDate ? `<tr><td>${esc(docLabel("dueDate", data, opts))}</td><td class="right">${fds(d.dueDate)}</td></tr>` : ""}
        ${data.customer ? `<tr><td>${esc(docLabel("customer", data, opts))}</td><td class="right">${esc(data.customer.name)}</td></tr>` : ""}
        ${data.customer?.phone ? `<tr><td>Phone</td><td class="right">${esc(data.customer.phone)}</td></tr>` : ""}
        <tr><td>${esc(docLabel("payment", data, opts))}</td><td class="right">${esc(d.paymentMethod?.replace(/_/g, " ") || "N/A")}</td></tr>
      </table>
    </div>
    <div class="divider"></div>
    <table class="items">
      <thead><tr><th>${esc(docLabel("item", data, opts))}</th><th class="right">${esc(docLabel("qty", data, opts))}</th><th class="right">${esc(docLabel("price", data, opts))}</th><th class="right">${esc(docLabel("total", data, opts))}</th></tr></thead>
      <tbody>${
        is58
          ? items
              .map(
                (item) =>
                  `<tr><td colspan="4">${esc(item.name)}${item.sku ? " (" + esc(item.sku) + ")" : ""}${item.description ? `<br/><span style="font-size:9px;color:#666;">${esc(item.description)}</span>` : ""}</td></tr><tr><td></td><td class="right">${item.quantity}</td><td class="right">${fmt(item.price, symbol)}</td><td class="right">${fmt(item.subtotal, symbol)}</td></tr>`,
              )
              .join("")
          : items
              .map(
                (item) =>
                  `<tr><td>${esc(item.name)}${item.description ? `<br/><span style="font-size:9px;color:#666;">${esc(item.description)}</span>` : ""}</td><td class="right">${item.quantity}</td><td class="right">${fmt(item.price, symbol)}</td><td class="right">${fmt(item.subtotal, symbol)}</td></tr>`,
              )
              .join("")
      }
    </tbody></table>
    <div class="divider"></div>
    <table class="summary">${totalsBlock(data, opts)}</table>
    ${d.notes ? `<p class="notes">${esc(docLabel("notes", data, opts))}: ${esc(d.notes)}</p>` : ""}
    ${d.terms ? `<p class="notes">${esc(docLabel("terms", data, opts))}: ${esc(d.terms)}</p>` : ""}
    ${qrBlock(data, opts)}
    ${opts.showBarcode ? `<div class="barcode-row"><p class="barcode-text">${esc(d.number)}</p></div>` : ""}
    <div class="footer">
      ${opts.footerText ? esc(opts.footerText) : "Thank you!"}
      ${operationalInfo(data)}
    </div>
  `;
  return wrapHtml(
    content,
    thermalStyles(is58 ? "THERMAL_58" : "THERMAL_80", true, false, false),
    opts,
  );
}

function renderPos(
  items: RenderData["items"],
  data: RenderData,
  opts: RenderOptions,
  is58: boolean,
): string {
  const d = data.document;
  const symbol = opts.currencySymbol || "PKR";
  const imgTag =
    opts.showLogo && data.company.logo
      ? `<img src="${esc(data.company.logo)}" alt="Logo" class="logo" />`
      : "";
  const content = `
    <div class="header">
      ${imgTag}
      <h1>${esc(data.company.name)}</h1>
      ${data.company.address ? `<p>${esc(data.company.address)}</p>` : ""}
      ${data.company.city ? `<p>${esc(data.company.city)}${data.company.state ? ", " + esc(data.company.state) : ""}</p>` : ""}
      ${data.company.country ? `<p>${esc(data.company.country)}</p>` : ""}
      ${data.company.phone ? `<p>Tel: ${esc(data.company.phone)}</p>` : ""}
    </div>
    <div class="divider-solid"></div>
    <div class="badge"><span>${esc(docLabel("invoice", data, opts).toUpperCase())}</span></div>
    <div style="text-align:center;margin-bottom:4px;">${paymentStatusBadge(d.status, "#000")} ${complianceBadge(data, opts)}</div>
    <div class="info">
      <table>
        <tr><td>${esc(docLabel("invoice", data, opts))} #</td><td class="right">${esc(d.number)}</td></tr>
        <tr><td>${esc(docLabel("date", data, opts))}</td><td class="right">${fds(d.date)}</td></tr>
        ${data.customer ? `<tr><td>${esc(docLabel("customer", data, opts))}</td><td class="right">${esc(data.customer.name)}</td></tr>` : ""}
      </table>
    </div>
    <div class="divider-solid"></div>
    <div class="items">
      ${items
        .map(
          (item) => `
        <div class="item-row">
          <div class="item-name">${esc(item.name)}</div>
          ${item.description ? `<div class="item-desc" style="font-size:10px;color:#666;">${esc(item.description)}</div>` : ""}
          <div class="item-detail">${item.quantity} x ${fmt(item.price, symbol)}${item.discount > 0 ? ` (-${fmt(item.discount, symbol)})` : ""}</div>
          <div class="item-total">${fmt(item.subtotal, symbol)}</div>
        </div>
      `,
        )
        .join("")}
    </div>
    <div class="divider-solid"></div>
    <table class="summary">${totalsBlock(data, opts)}</table>
    ${d.notes ? `<p class="notes">${esc(docLabel("notes", data, opts))}: ${esc(d.notes)}</p>` : ""}
    ${d.terms ? `<p class="notes">${esc(docLabel("terms", data, opts))}: ${esc(d.terms)}</p>` : ""}
    ${qrBlock(data, opts)}
    <div class="divider"></div>
    <div class="footer">
      ${opts.footerText ? esc(opts.footerText) : "Thank you for shopping!"}
      ${operationalInfo(data)}
    </div>
  `;
  return wrapHtml(
    content,
    thermalStyles(is58 ? "THERMAL_58" : "THERMAL_80", false, true, false),
    opts,
  );
}

function renderMinimal(
  items: RenderData["items"],
  data: RenderData,
  opts: RenderOptions,
  is58: boolean,
): string {
  const d = data.document;
  const symbol = opts.currencySymbol || "PKR";
  const content = `
    <div class="header">
      <h1>${esc(data.company.name)}</h1>
      ${data.company.phone ? `<p>${esc(data.company.phone)}</p>` : ""}
      ${data.company.taxId ? `<p>${esc(opts.taxName)}: ${esc(data.company.taxId)}</p>` : ""}
    </div>
    <div class="divider"></div>
    <div style="text-align:center;margin-bottom:4px;">${complianceBadge(data, opts)}</div>
    <div class="info">
      <table>
        <tr><td>#${esc(d.number)}</td><td class="right">${fds(d.date)}</td></tr>
        ${data.customer ? `<tr><td colspan="2">${esc(data.customer.name)}</td></tr>` : ""}
      </table>
    </div>
    <div class="divider"></div>
    <table class="items">
      <thead><tr><th>${esc(docLabel("item", data, opts))}</th><th class="right">${esc(docLabel("qty", data, opts))}</th><th class="right">${esc(docLabel("total", data, opts))}</th></tr></thead>
      <tbody>${items
        .map(
          (item) => `
        <tr><td>${esc(item.name)}</td><td class="right">${item.quantity}</td><td class="right">${fmt(item.subtotal, symbol)}</td></tr>
      `,
        )
        .join("")}</tbody>
    </table>
    <div class="divider"></div>
    <table class="summary">
      <tr><td>${esc(docLabel("total", data, opts))}</td><td class="right"><strong>${fmt(d.total, symbol)}</strong></td></tr>
      ${d.due > 0 ? `<tr class="due-row"><td>${esc(docLabel("due", data, opts))}</td><td class="right">${fmt(d.due, symbol)}</td></tr>` : ""}
    </table>
    ${qrBlock(data, opts)}
    ${d.notes ? `<p class="notes">${esc(d.notes)}</p>` : ""}
    ${d.terms ? `<p class="notes">${esc(d.terms)}</p>` : ""}
    <div class="footer">
      ${operationalInfo(data)}
      ${fds(d.date)}
    </div>
  `;
  return wrapHtml(
    content,
    thermalStyles(is58 ? "THERMAL_58" : "THERMAL_80", false, false, true),
    opts,
  );
}

export function renderThermalCompact58(data: RenderData, opts: RenderOptions): string {
  return renderCompact(data.items, data, opts, true);
}
export function renderThermalCompact80(data: RenderData, opts: RenderOptions): string {
  return renderCompact(data.items, data, opts, false);
}
export function renderThermalPos58(data: RenderData, opts: RenderOptions): string {
  return renderPos(data.items, data, opts, true);
}
export function renderThermalPos80(data: RenderData, opts: RenderOptions): string {
  return renderPos(data.items, data, opts, false);
}
export function renderThermalMinimal58(data: RenderData, opts: RenderOptions): string {
  return renderMinimal(data.items, data, opts, true);
}
