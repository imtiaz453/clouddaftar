import { getExpenses } from "@/actions/expenses";
import { ExpensesClient } from "@/features/expenses/expenses-client";

export default async function TenantAccountingExpensesPage() {
  const data = await getExpenses("approval").catch(() => ({
    data: [],
    summary: { toSubmit: 0, underValidation: 0, toReimburse: 0, total: 0 },
  }));
  return <ExpensesClient initialData={data} mode="approval" />;
}
