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
import { AddEmployeeDialog } from "./add-employee-dialog";
import { getEmployeesOverview } from "@/actions/employees";
import { getEmployeeRetention } from "@/actions/employees-hr";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function EmployeesPage() {
  try {
    const data = await getEmployeesOverview();
    const retention = await getEmployeeRetention();

    return (
      <div className="space-y-5">
        <PageHeader
          title="Employees"
          description="Employee records, departments, contracts, onboarding, and HR readiness"
        >
          <AddEmployeeDialog branches={data.branches} />
        </PageHeader>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Employees" value={data.summary.total} />
          <Metric label="Active" value={data.summary.active} />
          <Metric label="Departments" value={data.summary.departments} />
          <Metric label="Assigned" value={data.summary.branchAssigned} />
          <Metric label="Complete Profiles" value={data.summary.profilesComplete} />
          <Metric label="Avg Tenure" value={`${data.summary.averageTenure}d`} />
        </div>

        <Tabs defaultValue="directory" className="space-y-4">
          <TabsList>
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
            <TabsTrigger value="reporting">Reporting</TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
          </TabsList>

          <TabsContent value="directory">
            <Card className="overflow-hidden">
              <SectionHeader
                title="Employee Directory"
                description="Personnel file, work contact, branch assignment, access mode, and employment status."
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Department / Location</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.employees.map((employee) => (
                      <TableRow key={employee.membershipId} className="hover:bg-muted/30">
                        <TableCell>
                          {employee.hasSystemAccess ? (
                            <a
                              href={`/employees/${employee.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {employee.name || "Unnamed employee"}
                            </a>
                          ) : (
                            <p className="font-medium">{employee.name || "Unnamed employee"}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {employee.workEmail || "No work email"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {employee.workPhone || "No work phone"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{employee.jobTitle}</p>
                          <Badge variant="outline" className="mt-1">
                            {employee.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{employee.workLocation}</p>
                          <p className="text-xs text-muted-foreground">
                            {employee.branch
                              ? [employee.branch.code, employee.branch.city]
                                  .filter(Boolean)
                                  .join(" | ")
                              : "No branch assigned"}
                          </p>
                        </TableCell>
                        <TableCell>{employee.manager}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              employee.permissionMode === "custom"
                                ? "default"
                                : employee.hasSystemAccess
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {employee.hasSystemAccess
                              ? employee.permissionMode === "custom"
                                ? "Custom override"
                                : "System user"
                              : "No login"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.isActive ? "success" : "destructive"}>
                            {employee.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(employee.joinedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="departments">
            <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
              <Card className="overflow-hidden">
                <SectionHeader
                  title="Departments"
                  description="Branch-backed department structure with team size and manager coverage."
                />
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead className="text-right">Employees</TableHead>
                        <TableHead className="text-right">Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.departments.map((department) => (
                        <TableRow key={department.id}>
                          <TableCell>
                            <p className="font-medium">{department.name}</p>
                            <p className="text-xs text-muted-foreground">{department.code}</p>
                          </TableCell>
                          <TableCell>{department.manager}</TableCell>
                          <TableCell>{department.city || "Company-wide"}</TableCell>
                          <TableCell className="text-right">{department.employees}</TableCell>
                          <TableCell className="text-right">{department.active}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
              <Card className="p-4">
                <h2 className="text-sm font-semibold">HR Configuration</h2>
                <div className="mt-3 space-y-3 text-sm">
                  <ChecklistItem
                    label="Departments mirror active branches"
                    done={data.branches.length > 0}
                  />
                  <ChecklistItem
                    label="All employees assigned to a work location"
                    done={data.summary.branchAssigned === data.summary.total}
                  />
                  <ChecklistItem
                    label="Managers visible in department overview"
                    done={data.departments.some(
                      (department) => department.manager !== "Not assigned",
                    )}
                  />
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contracts">
            <Card className="overflow-hidden">
              <SectionHeader
                title="Contracts"
                description="Employment contract readiness used by payroll for structure, schedule, and work-entry source."
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Job Position</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Structure</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.contracts.map((contract) => (
                      <TableRow key={contract.employeeId}>
                        <TableCell className="font-medium">{contract.employeeName}</TableCell>
                        <TableCell>{contract.jobTitle}</TableCell>
                        <TableCell>{contract.department}</TableCell>
                        <TableCell>{contract.schedule}</TableCell>
                        <TableCell>{contract.structure}</TableCell>
                        <TableCell>
                          <Badge variant={contract.readiness === "Ready" ? "success" : "warning"}>
                            {contract.readiness}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(contract.startDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="onboarding">
            <div className="grid gap-4 lg:grid-cols-2">
              {data.onboarding.map((step) => (
                <Card key={step.step} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{step.step}</p>
                      <p className="text-xs text-muted-foreground">
                        {step.complete} of {step.total} employee records complete
                      </p>
                    </div>
                    <Badge variant={step.complete === step.total ? "success" : "warning"}>
                      {step.total === 0 ? 0 : Math.round((step.complete / step.total) * 100)}%
                    </Badge>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${step.total === 0 ? 0 : (step.complete / step.total) * 100}%`,
                      }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reporting">
            <div className="grid gap-4 lg:grid-cols-3">
              <ReportCard
                label="Retention"
                value={`${data.summary.averageTenure} days`}
                detail="Average tenure"
              />
              <ReportCard
                label="Profile Quality"
                value={`${data.summary.profilesComplete}/${data.summary.total}`}
                detail="Profiles with strong HR data"
              />
              <ReportCard
                label="Open Reimbursements"
                value={formatCurrency(data.summary.reimbursementsDue)}
                detail="Approved employee expenses"
              />
            </div>
          </TabsContent>

          <TabsContent value="retention">
            <div className="grid gap-4 lg:grid-cols-4">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Total Employees</p>
                <p className="mt-1 text-2xl font-semibold">{retention.total}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Avg Tenure</p>
                <p className="mt-1 text-2xl font-semibold">{retention.avgTenure} days</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">New Hires (&lt;90d)</p>
                <p className="mt-1 text-2xl font-semibold">{retention.lowTenure}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Retention Rate</p>
                <p className="mt-1 text-2xl font-semibold">
                  {retention.total > 0
                    ? Math.round((1 - retention.lowTenure / retention.total) * 100)
                    : 100}
                  %
                </p>
              </Card>
            </div>
            <Card className="mt-4 overflow-auto p-0">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Employees by Join Year</h2>
              </div>
              {Object.keys(retention.byYear).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="py-2 pl-2">Year</th>
                      <th className="py-2 pr-2 text-right">Hired</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(retention.byYear)
                      .sort(([a], [b]) => Number(b) - Number(a))
                      .map(([year, count]) => (
                        <tr key={year} className="border-b border-border/30">
                          <td className="py-1.5 pl-2 font-medium">{year}</td>
                          <td className="py-1.5 pr-2 text-right">{count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load employees</p>
      </div>
    );
  }
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
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

function ChecklistItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <span>{label}</span>
      <Badge variant={done ? "success" : "warning"}>{done ? "Ready" : "Needs data"}</Badge>
    </div>
  );
}

function ReportCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </Card>
  );
}
