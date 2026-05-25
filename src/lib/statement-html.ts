type StatementRow = {
  date: string | Date;
  reference?: string | null;
  description?: string | null;
  debit: number;
  credit: number;
  balance: number;
};

type StatementHtmlData = {
  title: string;
  partyLabel: string;
  partyName: string;
  partyPhone?: string | null;
  fromDate: string | Date;
  toDate: string | Date;
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  currencySymbol: string;
  transactions: StatementRow[];
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatMoney(value: number, currencySymbol: string) {
  const amount = Number(value || 0).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol} ${amount}`;
}

export function generateStatementHtml(data: StatementHtmlData) {
  const rows = data.transactions
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(formatDate(row.date))}</td>
          <td>${escapeHtml(row.reference)}</td>
          <td class="description">${escapeHtml(row.description)}</td>
          <td class="amount">${escapeHtml(formatMoney(row.debit, data.currencySymbol))}</td>
          <td class="amount">${escapeHtml(formatMoney(row.credit, data.currencySymbol))}</td>
          <td class="amount balance">${escapeHtml(formatMoney(row.balance, data.currencySymbol))}</td>
        </tr>
      `,
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111827;
        font-family: Arial, "Helvetica Neue", sans-serif;
        font-size: 12px;
        line-height: 1.45;
        background: #ffffff;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        padding-bottom: 18px;
        border-bottom: 2px solid #2563eb;
      }
      h1 {
        margin: 0;
        color: #2563eb;
        font-size: 30px;
        font-weight: 700;
        letter-spacing: 0;
      }
      .muted { color: #64748b; }
      .party {
        min-width: 220px;
        text-align: right;
      }
      .party strong {
        display: block;
        margin-top: 4px;
        color: #111827;
        font-size: 16px;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin: 18px 0;
      }
      .metric {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 12px;
      }
      .metric span {
        display: block;
        color: #64748b;
        font-size: 10px;
        text-transform: uppercase;
      }
      .metric strong {
        display: block;
        margin-top: 5px;
        font-size: 14px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      thead th {
        padding: 10px 8px;
        color: #ffffff;
        background: #2563eb;
        font-size: 11px;
        text-align: left;
      }
      tbody td {
        padding: 10px 8px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
        word-break: break-word;
      }
      tbody tr:nth-child(even) td { background: #f8fafc; }
      .description { width: 30%; }
      .amount { text-align: right; white-space: nowrap; }
      .balance { font-weight: 700; }
      .empty {
        padding: 28px 8px;
        color: #64748b;
        text-align: center;
      }
      .footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 18px;
      }
      .closing {
        min-width: 260px;
        border-top: 2px solid #2563eb;
        padding-top: 12px;
        text-align: right;
        font-size: 16px;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <section class="header">
      <div>
        <h1>${escapeHtml(data.title)}</h1>
        <div class="muted">${escapeHtml(formatDate(data.fromDate))} to ${escapeHtml(formatDate(data.toDate))}</div>
      </div>
      <div class="party">
        <span class="muted">${escapeHtml(data.partyLabel)}</span>
        <strong>${escapeHtml(data.partyName)}</strong>
        ${data.partyPhone ? `<div class="muted">${escapeHtml(data.partyPhone)}</div>` : ""}
      </div>
    </section>

    <section class="summary">
      <div class="metric"><span>Opening balance</span><strong>${escapeHtml(formatMoney(data.openingBalance, data.currencySymbol))}</strong></div>
      <div class="metric"><span>Total debit</span><strong>${escapeHtml(formatMoney(data.totalDebits, data.currencySymbol))}</strong></div>
      <div class="metric"><span>Total credit</span><strong>${escapeHtml(formatMoney(data.totalCredits, data.currencySymbol))}</strong></div>
      <div class="metric"><span>Closing balance</span><strong>${escapeHtml(formatMoney(data.closingBalance, data.currencySymbol))}</strong></div>
    </section>

    <table>
      <thead>
        <tr>
          <th style="width: 12%;">Date</th>
          <th style="width: 16%;">Reference</th>
          <th>Description</th>
          <th style="width: 14%;">Debit</th>
          <th style="width: 14%;">Credit</th>
          <th style="width: 14%;">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td class="empty" colspan="6">No transactions found for this period.</td></tr>`}
      </tbody>
    </table>

    <section class="footer">
      <div class="closing">Closing Balance: ${escapeHtml(formatMoney(data.closingBalance, data.currencySymbol))}</div>
    </section>
  </body>
</html>`;
}
