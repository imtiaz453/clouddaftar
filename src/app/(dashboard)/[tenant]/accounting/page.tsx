import { getAccountingDashboard } from "@/actions/accounting";
import { AccountingDashboardClient } from "@/features/accounting/accounting-dashboard-client";

const emptyDashboard = {
  customerInvoices: { toValidate: 0, unpaid: 0, unpaidAmount: 0, late: 0, lateAmount: 0 },
  vendorBills: { toValidate: 0, toPay: 0, toPayAmount: 0, late: 0, lateAmount: 0 },
  bank: { balance: 0, paymentsIn: 0, paymentsOut: 0, toReconcile: 0 },
  cash: { balance: 0, received: 0, paid: 0 },
  expenses: { underValidation: 0, toReimburse: 0 },
  chartOfAccounts: [
    { code: "101000", name: "Bank and Cash", type: "Asset", balance: 0, reconcile: true },
    { code: "110000", name: "Accounts Receivable", type: "Asset", balance: 0, reconcile: true },
    { code: "120000", name: "Inventory Valuation", type: "Asset", balance: 0, reconcile: false },
    { code: "200000", name: "Accounts Payable", type: "Liability", balance: 0, reconcile: true },
    {
      code: "220000",
      name: "Tax Payable / Receivable",
      type: "Liability",
      balance: 0,
      reconcile: false,
    },
  ],
  tax: { outputTax: 0, inputTax: 0, netTax: 0 },
  controls: { customers: 0, vendors: 0, reconciliations: 0, ledgerEntries: 0, inventoryValue: 0 },
  trend: [],
};

export default async function TenantAccountingPage() {
  const data = await getAccountingDashboard().catch(() => emptyDashboard);
  return <AccountingDashboardClient data={data} />;
}
