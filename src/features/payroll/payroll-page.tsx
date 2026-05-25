import {
  getContracts,
  getSalaryRules,
  getPayslips,
  getBatches,
  getWorkEntries,
  getSalaryAdjustments,
  getPayrollSummary,
  getHeadcountReport,
  getPayrollAnalysis,
  getPayrollEmployees,
} from "@/actions/payroll";
import { getAccounts } from "@/actions/accounting-coa";
import { PayrollClient } from "./payroll-client";

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export async function PayrollPage() {
  try {
    const [
      contracts,
      salaryRules,
      payslipsData,
      batches,
      workEntries,
      adjustments,
      summary,
      headcount,
      analysis,
      employees,
      accounts,
    ] = await Promise.all([
      getContracts(true),
      getSalaryRules(),
      getPayslips({}),
      getBatches(),
      getWorkEntries({}),
      getSalaryAdjustments({}),
      getPayrollSummary({}),
      getHeadcountReport(),
      getPayrollAnalysis(),
      getPayrollEmployees(),
      getAccounts(),
    ]);

    return (
      <PayrollClient
        contracts={plain(contracts)}
        salaryRules={plain(salaryRules)}
        payslips={plain(payslipsData)}
        batches={plain(batches)}
        workEntries={plain(workEntries)}
        adjustments={plain(adjustments)}
        summary={summary}
        headcount={headcount}
        analysis={plain(analysis)}
        employees={plain(employees)}
        accounts={plain(accounts)}
      />
    );
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load payroll</p>
      </div>
    );
  }
}
