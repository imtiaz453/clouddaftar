import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveTaxLabel } from "@/lib/tax-label";
import { getTemplateDef } from "@/lib/template-registry";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const companyId = (session.user as any).companyId;

    const purchase = await prisma.purchase.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        supplier: true,
        items: {
          include: { product: true },
        },
        payments: { include: { payment: true } },
        createdBy: { select: { name: true } },
        company: {
          include: { theme: true, settings: true },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    const paperSize = req.nextUrl.searchParams.get("size") || "A4";
    const templateId =
      req.nextUrl.searchParams.get("templateId") ||
      (purchase.company.settings as any)?.defaultPurchaseOrderTemplate ||
      null;
    const customTemplate =
      paperSize === "A4" && templateId
        ? await prisma.invoiceTemplate.findFirst({
            where: { id: templateId, companyId, paperSize: "A4", templateType: "purchase_order" },
          })
        : null;
    const builtInTemplate = templateId ? getTemplateDef(templateId) : null;
    const template =
      customTemplate ||
      (builtInTemplate?.type === "purchase_order"
        ? {
            primaryColor: builtInTemplate.previewColor,
            accentColor: builtInTemplate.previewAccent,
            paperSize: builtInTemplate.paperSize,
          }
        : null);
    const html = generatePOHtml(purchase as any, paperSize, template);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate purchase order" }, { status: 500 });
  }
}

function generatePOHtml(purchase: any, paperSize: string, template?: any): string {
  const isThermal = paperSize === "THERMAL_80" || paperSize === "THERMAL_58";
  if (isThermal) return generateThermalHtml(purchase, paperSize);
  return generateA4Html(purchase, template);
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value: unknown, symbol = "Rs"): string {
  const amount = Number(value) || 0;
  return `${esc(symbol)}${amount.toLocaleString("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function safeColor(value: unknown, fallback: string): string {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{3,8}$/i.test(color) || /^hsl\(/i.test(color) || /^rgb\(/i.test(color)) {
    return color;
  }
  return fallback;
}

function softColor(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return `${value}12`;
  if (/^#[0-9a-f]{3}$/i.test(value)) return `${value}2`;
  return "rgba(37, 136, 245, 0.08)";
}

function templateNumber(template: any, path: string[], fallback: number): number {
  const advanced = template?.advancedDesign || {};
  const value = path.reduce((obj, key) => obj?.[key], advanced);
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function formatDocDate(value: unknown): string {
  if (!value) return "-";
  return new Date(value as any).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function generateA4Html(purchase: any, template?: any): string {
  const { company, supplier, items, createdBy } = purchase;
  const settings = company.settings || {};
  const taxLabel = resolveTaxLabel({
    country: company.country,
    currency: company.currency,
    taxName: company.taxName,
    taxComplianceMode: settings.taxComplianceMode,
  });
  const primaryColor = safeColor(template?.primaryColor, "#2588f5");
  const accentColor = safeColor(template?.accentColor, primaryColor);
  const paleBlue = softColor(accentColor);
  const currencySymbol = company.currencySymbol || company.currency || "Rs";
  const paid = Number(purchase.paid) || 0;
  const due = Number(purchase.due) || 0;
  const subtotal = Number(purchase.subtotal) || 0;
  const discount = Number(purchase.discount) || 0;
  const tax = Number(purchase.tax) || 0;
  const total = Number(purchase.total) || 0;
  const payments = purchase.payments || [];
  const lineTaxableAmount = items.reduce(
    (sum: number, item: any) => sum + Number(item.subtotal || 0),
    0,
  );
  const taxableAmount = lineTaxableAmount || Math.max(0, subtotal - discount);
  const supplierAddress = [
    supplier?.address,
    supplier?.city,
    supplier?.state,
    supplier?.zipCode,
    supplier?.country,
  ]
    .filter(Boolean)
    .join(", ");
  const companyAddress = [
    company.address,
    company.city,
    company.state,
    company.zipCode,
    company.country,
  ]
    .filter(Boolean)
    .join(", ");
  const totalQty = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  const terms = purchase.terms || settings.purchaseTerms || settings.defaultPurchaseTerms || "";
  const showLogo = template?.showLogo !== false;
  const footerText = template?.footerText || template?.advancedDesign?.content?.footerText || "";
  const topPadding = templateNumber(template, ["layout", "topPadding"], 38);
  const sidePadding = templateNumber(template, ["layout", "sidePadding"], 48);
  const sectionGap = templateNumber(template, ["layout", "sectionGap"], 44);
  const logoWidth = templateNumber(template, ["layout", "logoWidth"], 280);
  const logoHeight = templateNumber(template, ["layout", "logoHeight"], 120);
  const radius = templateNumber(template, ["layout", "borderRadius"], 4);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PO ${purchase.referenceNumber}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      color: #18212f;
      line-height: 1.55;
      background: #fff;
    }
    .page { min-height: 297mm; display: flex; flex-direction: column; }
    .hero { background: ${paleBlue}; padding: ${topPadding}px ${sidePadding}px ${topPadding + 8}px; display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: start; }
    .title { color: ${primaryColor}; font-size: 46px; font-weight: 300; letter-spacing: 0; line-height: 1.1; }
    .muted { color: #6c7f98; }
    .label { display: inline-block; border-left: 2px solid ${accentColor}; background: #edf5ff; color: #6c7f98; padding: 2px 8px; font-size: 13px; margin-bottom: 8px; }
    .party h2, .meta h2 { font-size: 18px; line-height: 1.2; margin-bottom: 8px; }
    .logo-wrap { text-align: right; color: ${accentColor}; font-weight: 800; font-size: 34px; line-height: 1; letter-spacing: 1px; }
    .logo-img { max-width: ${logoWidth}px; max-height: ${logoHeight}px; object-fit: contain; }
    .content { padding: ${sidePadding}px; flex: 1; }
    .info-grid { display: grid; grid-template-columns: 1.2fr .8fr .8fr; gap: 48px; margin-bottom: ${sectionGap}px; }
    .kv { display: grid; grid-template-columns: 92px 1fr; gap: 7px 16px; }
    .kv strong, .totals strong { color: #121925; }
    .payment-due { color: ${accentColor}; font-size: 28px; line-height: 1.1; }
    table.items { width: 100%; border-collapse: collapse; border: 1.5px solid ${accentColor}; margin-bottom: 28px; }
    table.items th { background: ${accentColor}; color: #fff; padding: 12px 16px; text-align: left; font-size: 14px; font-weight: 700; }
    table.items td { padding: 18px 16px; color: #3f5874; font-size: 15px; }
    table.items tbody tr:nth-child(odd) td { background: ${paleBlue}; }
    table.items .item-name { color: #18212f; font-weight: 700; }
    table.items .right, .right { text-align: right; }
    .lower { display: grid; grid-template-columns: 1.3fr .75fr; gap: 60px; align-items: start; }
    .supply { display: grid; grid-template-columns: 120px 1fr; gap: 6px 20px; margin-bottom: 30px; font-size: 14px; }
    .words-title, .payments-title { font-weight: 700; margin: 24px 0 10px; }
    .words { color: ${accentColor}; font-size: 19px; font-weight: 700; }
    .payment-table { width: 100%; max-width: 540px; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid #d8dee7; border-radius: ${radius}px; }
    .payment-table th { background: #50677e; color: #fff; padding: 9px 12px; text-align: left; font-weight: 500; }
    .payment-table td { padding: 10px 12px; color: #40566f; }
    .approved { background: #10b66a; color: #fff; border-radius: 4px; padding: 3px 8px; font-size: 12px; }
    .totals { width: 100%; border-collapse: collapse; }
    .totals td { padding: 10px 0; color: #40566f; font-size: 16px; }
    .totals td:last-child { text-align: right; font-weight: 700; color: #121925; }
    .totals .grand td { border-top: 1px solid #cbd5e1; padding-top: 24px; font-size: 21px; color: #121925; }
    .totals .grand td:last-child { color: ${accentColor}; font-size: 29px; }
    .footer-band { background: ${paleBlue}; padding: 44px ${sidePadding}px 84px; display: grid; grid-template-columns: 1fr 1fr; gap: 70px; }
    .footer-band h3 { font-size: 15px; margin-bottom: 16px; }
    .footer-band p, .footer-band li { color: #40566f; font-size: 14px; line-height: 1.7; }
    .footer-band ol { padding-left: 22px; }
    .no-print { text-align: center; padding: 18px; }
    @media print { .no-print { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1 class="title">Purchase Order</h1>
      <div class="logo-wrap">
        ${showLogo ? (company.logo ? `<img src="${esc(company.logo)}" alt="Logo" class="logo-img" />` : esc(company.name || "Business")) : ""}
      </div>
    </section>

    <main class="content">
      <section class="info-grid">
        <div class="party">
          <span class="label">Order By</span>
          <h2>${esc(company.name || "Business Name")}</h2>
          <p class="muted">${esc(companyAddress || "")}</p>
          ${company.taxId ? `<p style="margin-top:14px;"><strong>${esc(taxLabel)}</strong>&nbsp; <span class="muted">${esc(company.taxId)}</span></p>` : ""}
        </div>
        <div class="meta">
          <span class="label">Order To</span>
          <h2>${esc(supplier?.name || "Supplier")}</h2>
          <p class="muted" style="margin-bottom:14px;">${esc(supplierAddress || "")}</p>
          ${supplier?.taxId ? `<p style="margin-bottom:14px;"><strong>${esc(taxLabel)}</strong>&nbsp; <span class="muted">${esc(supplier.taxId)}</span></p>` : ""}
          <div class="kv">
            <strong>PO #</strong><span class="muted">${esc(purchase.referenceNumber)}</span>
            <strong>Order Date</strong><span class="muted">${formatDocDate(purchase.createdAt)}</span>
            <strong>Due Date</strong><span class="muted">${formatDocDate(purchase.dueDate)}</span>
            <strong>Status</strong><span class="muted">${esc(purchase.status.replace("_", " "))}</span>
          </div>
        </div>
        <div class="meta">
          <span class="label">Payment Record</span>
          <div class="kv">
            <strong>Paid Amount</strong><span class="muted">${money(paid, currencySymbol)}</span>
            <strong>Due Amount</strong><strong class="payment-due">${money(due, currencySymbol)}</strong>
          </div>
        </div>
      </section>

      <table class="items">
        <thead>
          <tr>
            <th>Item #/Item description</th>
            <th>HSN</th>
            <th>Qty.</th>
            <th class="right">Unit Price</th>
            <th class="right">VAT %</th>
            <th class="right">VAT per line</th>
            <th class="right">Amount inclusive of VAT</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map((item: any) => {
              const lineBase =
                Number(item.subtotal || 0) ||
                Number(item.price || 0) * Number(item.quantity || 0) - Number(item.discount || 0);
              const lineTax = (lineBase * Number(item.tax || 0)) / 100;
              return `
              <tr>
                <td class="item-name">${esc(item.product?.name || "Item")}</td>
                <td>${esc(item.product?.hsn || item.product?.sku || "")}</td>
                <td>${esc(item.quantity)}</td>
                <td class="right">${money(item.price, currencySymbol)}</td>
                <td class="right">${Number(item.tax || 0)}%</td>
                <td class="right">${money(lineTax, currencySymbol)}</td>
                <td class="right"><strong>${money(Number(item.subtotal || 0) + lineTax, currencySymbol)}</strong></td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>

      <section class="lower">
        <div>
          <div class="supply">
            <strong>Country of supply</strong><span class="muted">${esc(company.country || "")}</span>
            <strong>Place of supply</strong><span class="muted">${esc(company.state || company.city || "")}</span>
            <strong>Total quantity</strong><span class="muted">${esc(totalQty)}</span>
          </div>
          <p class="words-title">Purchase order total</p>
          <p class="words">${money(total, currencySymbol)}</p>
          <p class="payments-title">Payments</p>
          <table class="payment-table">
            <thead><tr><th>Date</th><th>Mode</th><th>Status</th><th>Amount</th><th>Reference</th></tr></thead>
            <tbody>
              ${
                payments.length
                  ? payments
                      .map(
                        (allocation: any) => `
                <tr>
                  <td>${formatDocDate(allocation.payment?.paymentDate)}</td>
                  <td>${esc(allocation.payment?.paymentMethod?.replace("_", " ") || "-")}</td>
                  <td><span class="approved">Approved</span></td>
                  <td>${money(allocation.allocatedAmount, currencySymbol)}</td>
                  <td>${esc(allocation.payment?.reference || "-")}</td>
                </tr>`,
                      )
                      .join("")
                  : `<tr><td colspan="5" class="muted">No payment recorded</td></tr>`
              }
            </tbody>
          </table>
        </div>
        <table class="totals">
          <tr><td>Amount</td><td>${money(taxableAmount, currencySymbol)}</td></tr>
          <tr><td>Total VAT</td><td>${money(tax, currencySymbol)}</td></tr>
          <tr><td>Total amount inclusive of VAT</td><td>${money(total, currencySymbol)}</td></tr>
          <tr><td>Paid Amount</td><td>${money(paid, currencySymbol)}</td></tr>
          <tr class="grand"><td>Total Due</td><td>${money(due, currencySymbol)}</td></tr>
        </table>
      </section>
    </main>

    <section class="footer-band">
      <div>
        <h3>Terms and Conditions</h3>
        ${
          terms
            ? `<p style="white-space:pre-wrap;">${esc(terms)}</p>`
            : `<ol><li>Please process this purchase order according to agreed supplier terms.</li><li>Please quote purchase order number when remitting documents.</li></ol>`
        }
      </div>
      <div>
        <h3>Additional Notes</h3>
        <p style="white-space:pre-wrap;">${esc(purchase.notes || footerText || "For any enquiries, contact " + (company.email || company.phone || company.name || "our team") + ".")}</p>
        ${createdBy?.name ? `<p style="margin-top:18px;"><strong>Prepared by:</strong> ${esc(createdBy.name)}</p>` : ""}
      </div>
    </section>
  </div>

  <div class="no-print" style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 30px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff;">Print / Save PDF</button>
    <button onclick="window.close()" style="padding:10px 30px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff;margin-left:10px;">Close</button>
  </div>

  <script>window.print();</script>
</body>
</html>`;
}

function generateThermalHtml(purchase: any, paperSize: string): string {
  const { company, supplier, items, createdBy } = purchase;
  const settings = company.settings || {};
  const taxLabel = resolveTaxLabel({
    country: company.country,
    currency: company.currency,
    taxName: company.taxName,
    taxComplianceMode: settings.taxComplianceMode,
  });
  const thermalWidth = paperSize === "THERMAL_58" ? "58mm" : "80mm";
  const pageWidth = thermalWidth;
  const fontSize = "10px";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PO ${purchase.referenceNumber}</title>
  <style>
    @page { size: ${pageWidth}; margin: 5mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: ${fontSize}; color: #000; line-height: 1.4; }
    .header { text-align: center; margin-bottom: 8px; }
    .header h1 { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
    .header p { font-size: 9px; color: #555; }
    .divider { border-top: 1px dashed #999; margin: 6px 0; }
    .info { margin-bottom: 6px; }
    .info table { width: 100%; font-size: 9px; }
    .info td { padding: 1px 0; }
    .info td:last-child { text-align: right; }
    .items { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    .items th { border-bottom: 1px solid #000; padding: 3px 2px; text-align: left; font-size: 9px; }
    .items td { padding: 3px 2px; font-size: 9px; vertical-align: top; }
    .items .right { text-align: right; }
    .summary { width: 100%; margin-bottom: 6px; }
    .summary td { padding: 2px 0; font-size: 9px; }
    .summary .right { text-align: right; }
    .summary .total { font-weight: bold; font-size: 11px; border-top: 1px solid #000; padding-top: 4px; }
    .footer { text-align: center; font-size: 8px; color: #999; margin-top: 8px; }
    .badge { text-align: center; margin-bottom: 6px; }
    .badge span { background: #000; color: #fff; padding: 2px 8px; font-size: 9px; letter-spacing: 1px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    ${company.logo ? `<img src="${company.logo}" alt="Logo" style="max-height:60px;margin-bottom:8px;object-fit:contain;" />` : ""}
    <h1>${company.name || "Business Name"}</h1>
    ${company.address ? `<p>${company.address}</p>` : ""}
    ${company.city ? `<p>${company.city}${company.state ? ", " + company.state : ""}</p>` : ""}
    ${company.phone ? `<p>Tel: ${company.phone}</p>` : ""}
    ${company.email ? `<p>Email: ${company.email}</p>` : ""}
    ${company.taxId ? `<p>${taxLabel} ID: ${company.taxId}</p>` : ""}
  </div>

  <div class="divider"></div>

  <div class="badge">
    <span>PURCHASE ORDER</span>
  </div>

  <div class="info">
    <table>
      <tr><td>PO #</td><td class="right">${purchase.referenceNumber}</td></tr>
      <tr><td>Date</td><td class="right">${new Date(purchase.createdAt).toLocaleDateString()}</td></tr>
      ${purchase.dueDate ? `<tr><td>Due Date</td><td class="right">${new Date(purchase.dueDate).toLocaleDateString()}</td></tr>` : ""}
      <tr><td>Status</td><td class="right">${purchase.status.replace("_", " ")}</td></tr>
      ${supplier ? `<tr><td>Supplier</td><td class="right">${supplier.name}</td></tr>` : ""}
      ${supplier?.phone ? `<tr><td>Phone</td><td class="right">${supplier.phone}</td></tr>` : ""}
      ${purchase.paymentMethod ? `<tr><td>Payment</td><td class="right">${purchase.paymentMethod}</td></tr>` : ""}
    </table>
  </div>

  <div class="divider"></div>

  <table class="items">
    <thead>
      <tr>
        <th>Item</th>
        <th class="right">Qty</th>
        <th class="right">Price</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item: any) => `
        <tr>
          <td>${item.product?.name || "Item"}</td>
          <td class="right">${item.quantity}</td>
          <td class="right">${Number(item.price).toFixed(2)}</td>
          <td class="right">${Number(item.subtotal).toFixed(2)}</td>
        </tr>
        ${Number(item.discount) > 0 ? `<tr><td colspan="3" class="right" style="font-size:9px;color:#999;">Discount</td><td class="right" style="font-size:9px;color:#999;">-${Number(item.discount).toFixed(2)}</td></tr>` : ""}
      `,
        )
        .join("")}
    </tbody>
  </table>

  <div class="divider"></div>

  <table class="summary">
    <tr><td>Subtotal</td><td class="right">${Number(purchase.subtotal).toFixed(2)}</td></tr>
    ${Number(purchase.discount) > 0 ? `<tr><td>Discount</td><td class="right">-${Number(purchase.discount).toFixed(2)}</td></tr>` : ""}
    ${Number(purchase.tax) > 0 ? `<tr><td>${taxLabel}</td><td class="right">${Number(purchase.tax).toFixed(2)}</td></tr>` : ""}
    <tr class="total"><td>Total</td><td class="right">${Number(purchase.total).toFixed(2)}</td></tr>
    <tr><td>Paid</td><td class="right">${Number(purchase.paid).toFixed(2)}</td></tr>
    ${Number(purchase.due) > 0 ? `<tr><td>Due</td><td class="right">${Number(purchase.due).toFixed(2)}</td></tr>` : ""}
  </table>

  ${purchase.notes ? `<p style="font-size:8px;color:#666;margin-top:4px;">Notes: ${purchase.notes}</p>` : ""}

  <div class="footer">
    <p>Thank you for your business!</p>
    ${createdBy?.name ? `<p style="margin-top:2px;">Created by: ${createdBy.name}</p>` : ""}
  </div>

  <div class="no-print" style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 30px;font-size:14px;cursor:pointer;">Print / Save PDF</button>
    <button onclick="window.close()" style="padding:10px 30px;font-size:14px;cursor:pointer;margin-left:10px;">Close</button>
  </div>

  <script>window.print();</script>
</body>
</html>`;
}
