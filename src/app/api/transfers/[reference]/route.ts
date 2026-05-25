import { getTransferByReference } from "@/actions/inventory";
import { getCompanySettings } from "@/actions/settings";
import { formatDateTime } from "@/lib/utils";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference: rawReference } = await params;
  const reference = decodeURIComponent(rawReference);

  try {
    const transfer = await getTransferByReference(reference);
    const company = await getCompanySettings();
    const companyName = escapeHtml(company?.name || "");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Transfer - ${escapeHtml(transfer.reference)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #111; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .header .meta { text-align: right; font-size: 12px; color: #6b7280; }
  .header .meta p { margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
  .info-box { background: #f9fafb; border-radius: 8px; padding: 14px 16px; }
  .info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 6px; }
  .info-box p { font-size: 14px; font-weight: 500; }
  .info-box .sub { font-size: 12px; color: #6b7280; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  td:last-child, th:last-child { text-align: right; }
  .notes-box { background: #f9fafb; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; }
  .notes-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 6px; }
  .footer { text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 32px; }
  @media print { body { padding: 20px; } .no-print { display: none !important; } }
</style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px;">
    <button onclick="window.print()" style="padding:8px 20px;background:#111;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">Print</button>
    <button onclick="window.close()" style="padding:8px 20px;background:#e5e7eb;color:#111;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin-left:8px;">Close</button>
  </div>

  <div class="header">
    <div>
      <h1>Stock Transfer</h1>
      <p style="font-size:12px;color:#6b7280;margin-top:4px;">${companyName}</p>
    </div>
    <div class="meta">
      <p><strong>Reference:</strong> ${escapeHtml(transfer.reference)}</p>
      <p><strong>Date:</strong> ${formatDateTime(transfer.createdAt)}</p>
      ${transfer.createdBy ? `<p><strong>By:</strong> ${escapeHtml(transfer.createdBy.name)}</p>` : ""}
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>From Warehouse</h3>
      ${
        transfer.fromWarehouse
          ? `<p>${escapeHtml(transfer.fromWarehouse.name)}</p><p class="sub">${escapeHtml(
              transfer.fromWarehouse.code,
            )}</p>`
          : '<p class="sub">N/A</p>'
      }
    </div>
    <div class="info-box">
      <h3>To Warehouse</h3>
      ${
        transfer.toWarehouse
          ? `<p>${escapeHtml(transfer.toWarehouse.name)}</p><p class="sub">${escapeHtml(
              transfer.toWarehouse.code,
            )}</p>`
          : '<p class="sub">N/A</p>'
      }
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>SKU</th>
        <th>Qty</th>
      </tr>
    </thead>
    <tbody>
      ${transfer.items
        .map(
          (item) => `
        <tr>
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(item.productSku || "-")}</td>
          <td>${item.quantity} ${escapeHtml(item.productUnit || "")}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>

  ${
    transfer.notes
      ? `
    <div class="notes-box">
      <h3>Notes</h3>
      <p>${escapeHtml(transfer.notes)}</p>
    </div>
  `
      : ""
  }

  <div class="footer">
    <p>${companyName} - Document generated on ${formatDateTime(new Date())}</p>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('print') === '1') {
      window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 500); });
    }
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new Response("Transfer not found", { status: 404 });
  }
}
