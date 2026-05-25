import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { formatCurrency } from "@/lib/utils";

async function getBranding() {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["logoUrl", "appName"] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { logoUrl: map.logoUrl || "", appName: map.appName || "Cloud Daftar" };
  } catch {
    return { logoUrl: "", appName: "Cloud Daftar" };
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const companyId = (session.user as any).companyId;

    const invoice = await prisma.billingInvoice.findFirst({
      where: { id, companyId },
      include: {
        company: true,
        plan: true,
        payment: true,
        subscription: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const branding = await getBranding();
    const html = generateInvoiceHtml(invoice as any, branding);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}

function generateInvoiceHtml(invoice: any, branding: { logoUrl: string; appName: string }): string {
  const { company, plan, payment } = invoice;
  const totalAmount = formatCurrency(Number(invoice.amount), invoice.currency || company.currency, invoice.currencySymbol || company.currencySymbol);
  const statusColors: Record<string, string> = {
    PENDING: "#f59e0b", SUBMITTED: "#3b82f6",
    CONFIRMED: "#10b981", REJECTED: "#ef4444", EXPIRED: "#6b7280",
  };
  const statusColor = statusColors[invoice.status] || "#6b7280";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 10pt; color: #1e293b; line-height: 1.5;
    }
    .top-bar { height: 4px; background: #3b82f6; margin: -15mm -15mm 20mm; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-left .logo { height: 48px; width: auto; object-fit: contain; }
    .header-left .brand-text h1 { font-size: 18pt; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .header-left .brand-text p { font-size: 9pt; color: #64748b; line-height: 1.6; }
    .header-right { text-align: right; }
    .badge {
      display: inline-block; padding: 4px 16px; font-size: 9pt; font-weight: 600;
      letter-spacing: 1px; border-radius: 4px; margin-bottom: 12px;
      background: ${statusColor}; color: #fff;
    }
    .label { font-size: 8pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { font-size: 11pt; font-weight: 600; color: #0f172a; margin-bottom: 6px; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
    .info-grid { display: flex; justify-content: space-between; margin-bottom: 24px; }
    .info-grid .box h3 { font-size: 8pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .info-grid .box p { font-size: 10pt; }
    table.details { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    table.details td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 10pt; }
    table.details td:last-child { text-align: right; font-weight: 600; }
    table.details tr:last-child td { border-bottom: 2px solid #e2e8f0; font-size: 13pt; font-weight: 700; }
    .payment-info { background: #f8fafc; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
    .payment-info h3 { font-size: 9pt; color: #0f172a; margin-bottom: 8px; }
    .payment-info p { font-size: 10pt; color: #475569; margin-bottom: 2px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    .footer p { font-size: 9pt; color: #94a3b8; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="top-bar"></div>
  <div class="header">
    <div class="header-left">
      ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${branding.appName}" class="logo" />` : ""}
      <div class="brand-text">
        <h1>${branding.appName}</h1>
        <p>Subscription Invoice</p>
      </div>
    </div>
    <div class="header-right">
      <div class="badge">${invoice.status}</div>
      <div><span class="label">Invoice #</span></div>
      <div class="value">${invoice.invoiceNumber}</div>
      <div style="margin-top:8px;"><span class="label">Issue Date</span></div>
      <div class="value">${new Date(invoice.issueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
  </div>

  <hr class="divider" />

  <div class="info-grid">
    <div class="box">
      <h3>Bill To</h3>
      <p>${company.name}</p>
      <p>${company.email || ""}</p>
      <p>${company.phone || ""}</p>
      <p>${company.address || ""}${company.city ? ", " + company.city : ""}</p>
    </div>
    <div class="box" style="text-align:right;">
      <h3>Subscription</h3>
      <p>${plan.name} Plan (${invoice.billingCycle === "MONTHLY" ? "Monthly" : "Yearly"})</p>
      <p style="font-size:9pt;color:#64748b;">
        ${new Date(invoice.periodStart).toLocaleDateString()} - ${new Date(invoice.periodEnd).toLocaleDateString()}
      </p>
    </div>
  </div>

  <table class="details">
    <tr><td>Plan</td><td>${plan.name}</td></tr>
    <tr><td>Billing Cycle</td><td>${invoice.billingCycle === "MONTHLY" ? "Monthly" : "Yearly"}</td></tr>
    <tr><td>Period</td><td>${new Date(invoice.periodStart).toLocaleDateString()} - ${new Date(invoice.periodEnd).toLocaleDateString()}</td></tr>
    <tr><td>Due Date</td><td>${new Date(invoice.dueDate).toLocaleDateString()}</td></tr>
    <tr style="border-top:2px solid #e2e8f0;"><td>Total Amount</td><td>${totalAmount}</td></tr>
  </table>

  <div class="payment-info">
    <h3>Payment Instructions</h3>
    <p><strong>Easypaisa:</strong> 03495940892</p>
    <p style="margin-top:8px;"><strong>Bank Transfer (ABL)</strong></p>
    <p>Account Title: IMTIAZ AHMED</p>
    <p>Account Number: 51520020136028930017</p>
    ${payment ? `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
      <p><strong>Transaction Ref:</strong> ${payment.transactionRef || "N/A"}</p>
      <p><strong>Submitted:</strong> ${new Date(payment.submittedAt).toLocaleString()}</p>
    </div>` : ""}
  </div>

  <div class="footer">
    <p>${branding.appName} - All-in-One Business Management Platform</p>
    <p style="margin-top:2px;">Thank you for choosing ${branding.appName}!</p>
  </div>

  <div class="no-print" style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 30px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff;">Download / Print PDF</button>
    <button onclick="window.close()" style="padding:10px 30px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff;margin-left:10px;">Close</button>
  </div>
  <script>window.print();</script>
</body>
</html>`;
}
