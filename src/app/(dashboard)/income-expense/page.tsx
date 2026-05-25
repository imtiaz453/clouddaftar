import { requireCompanyAuth } from "@/lib/auth-helper";
import { getIncomeExpense } from "@/actions/accounting";
import { IncomeExpenseClient } from "@/features/accounting/income-expense-client";
import { PageHeader } from "@/components/shared/page-header";

export default async function IncomeExpensePage() {
  await requireCompanyAuth();
  const data = await getIncomeExpense().catch(() => ({
    monthly: [] as any[], summary: { totalIncome: 0, totalExpense: 0, netProfit: 0 },
    paymentMethodIncome: {}, paymentMethodExpense: {}, year: new Date().getFullYear(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Income & Expense" description="Track income, expenses, and profitability" />
      <IncomeExpenseClient initialData={data as any} />
    </div>
  );
}
