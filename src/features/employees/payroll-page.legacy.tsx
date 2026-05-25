import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { getPayrollOverview } from "@/actions/employees";
import { formatCurrency } from "@/lib/utils";

const payrollVariant: Record<
  string,
  "secondary" | "warning" | "success" | "destructive" | "default"
> = {
  READY: "success",
  TO_REIMBURSE: "warning",
  WAITING_APPROVAL: "secondary",
  NEEDS_CONTRACT_DATA: "destructive",
};

export async function PayrollPage() {
  try {
    const data = await getPayrollOverview();

    return (
      <div className="space-y-5">
        <PageHeader
          title="Payroll"
          description="Contracts, work entries, payslips, salary rules, batches, and employee payments"
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Employees" value={String(data.summary.employees)} />
          <Metric label="Ready" value={String(data.summary.readyEmployees)} />
          <Metric label="Claims to Pay" value={String(data.summary.claimsToReimburse)} />
          <Metric label="Waiting Approval" value={String(data.summary.waitingApproval)} />
          <Metric label="To Pay" value={formatCurrency(data.summary.toReimburse)} />
          <Metric label="Conflicts" value={String(data.summary.workEntryConflicts)} />
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="work-entries">Work Entries</TabsTrigger>
            <TabsTrigger value="payslips">Payslips</TabsTrigger>
            <TabsTrigger value="batches">Batches</TabsTrigger>
            <TabsTrigger value="rules">Salary Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Card className="overflow-hidden">
              <SectionHeader
                title="Payroll Workbench"
                description="Employee payroll status, contract readiness, expense reimbursements, and payment handoff."
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Contract</TableHead>
                      <TableHead>Branch / Store</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Submitted</TableHead>
                      <TableHead className="text-right">Open Claims</TableHead>
                      <TableHead className="text-right">To Pay</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row) => (
                      <TableRow key={row.employeeId}>
                        <TableCell>
                          <p className="font-medium">{row.name || "Unnamed employee"}</p>
                          <p className="text-xs text-muted-foreground">{row.email}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{row.structure}</p>
                          <p className="text-xs text-muted-foreground">{row.jobTitle}</p>
                        </TableCell>
                        <TableCell>
                          {row.branch
                            ? `${row.branch.name} (${row.branch.code})`
                            : "Needs work location"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={payrollVariant[row.payrollStatus] || "secondary"}>
                            {row.payrollStatus.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{row.submittedClaims}</TableCell>
                        <TableCell className="text-right">{row.reimbursableClaims}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(row.reimbursableAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.reimbursedAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="contracts">
            <Card className="overflow-hidden">
              <SectionHeader
                title="Payroll Contracts"
                description="Contracts define salary structure, schedule, and work-entry source before payslips are generated."
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Structure</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row) => (
                      <TableRow key={row.employeeId}>
                        <TableCell className="font-medium">
                          {row.name || "Unnamed employee"}
                        </TableCell>
                        <TableCell>{row.structure}</TableCell>
                        <TableCell>
                          {row.contractStatus === "RUNNING"
                            ? "Working Schedule"
                            : "Missing work location"}
                        </TableCell>
                        <TableCell>
                          {row.workDays} days / {row.workHours} hours
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.contractStatus === "RUNNING" ? "success" : "warning"}>
                            {row.contractStatus.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="work-entries">
            <Card className="overflow-hidden">
              <SectionHeader
                title="Work Entries"
                description="Monthly work-entry readiness generated from contracts and schedules."
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Conflicts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.workEntries.map((entry) => (
                      <TableRow key={entry.employeeId}>
                        <TableCell className="font-medium">{entry.employeeName}</TableCell>
                        <TableCell>{entry.source}</TableCell>
                        <TableCell>{entry.type}</TableCell>
                        <TableCell className="text-right">{entry.days}</TableCell>
                        <TableCell className="text-right">{entry.hours}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={entry.conflicts > 0 ? "destructive" : "success"}>
                            {entry.conflicts}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="payslips">
            <Card className="overflow-hidden">
              <SectionHeader
                title="Payslips"
                description="Payslip queue using current payroll readiness and approved employee reimbursements."
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Structure</TableHead>
                      <TableHead className="text-right">Worked Days</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.payslips.map((slip) => (
                      <TableRow key={slip.reference}>
                        <TableCell className="font-medium">{slip.reference}</TableCell>
                        <TableCell>{slip.employeeName}</TableCell>
                        <TableCell>{slip.batch}</TableCell>
                        <TableCell>{slip.structure}</TableCell>
                        <TableCell className="text-right">{slip.workedDays}</TableCell>
                        <TableCell className="text-right">{formatCurrency(slip.gross)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(slip.net)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              slip.status === "BLOCKED"
                                ? "destructive"
                                : slip.status === "TO PAY"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {slip.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="batches">
            <div className="grid gap-4 lg:grid-cols-2">
              {data.batches.map((batch) => (
                <Card key={batch.name} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">{batch.name}</h2>
                      <p className="text-xs text-muted-foreground">{batch.period}</p>
                    </div>
                    <Badge variant={batch.toPay > 0 ? "warning" : "success"}>{batch.status}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <SmallMetric label="Employees" value={String(batch.employees)} />
                    <SmallMetric label="To Pay" value={formatCurrency(batch.toPay)} />
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="rules">
            <Card className="overflow-hidden">
              <SectionHeader
                title="Salary Rules"
                description="Default payroll rule stack for salary computation and reimbursements."
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sequence</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Condition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.salaryRules.map((rule) => (
                      <TableRow key={rule.code}>
                        <TableCell>{rule.sequence}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.code}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>{rule.category}</TableCell>
                        <TableCell>{rule.condition}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load payroll</p>
      </div>
    );
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b px-4 py-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
