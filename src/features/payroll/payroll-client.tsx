"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, FileDown, Play, CheckCircle, XCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { useToast } from "@/providers/toast-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  Contract,
  SalaryRule,
  Payslip,
  PayrollBatch,
  WorkEntry,
  SalaryAdjustment,
  CoaAccount,
} from "@prisma/client";

interface PayrollClientProps {
  contracts: Contract[];
  salaryRules: SalaryRule[];
  payslips: {
    data: Payslip[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  batches: PayrollBatch[];
  workEntries: WorkEntry[];
  adjustments: SalaryAdjustment[];
  summary: {
    payslips: number;
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
    totalEmployerCost: number;
  };
  headcount: { activeContracts: number; totalContracts: number; activeEmployees: number };
  analysis: {
    payslips: Payslip[];
    totalByEmployee: { name: string; count: number; total: number }[];
  };
  employees: { id: string; name: string | null; email: string; role: string }[];
  accounts: CoaAccount[];
}

const statusVariant: Record<string, "secondary" | "default" | "success" | "destructive"> = {
  DRAFT: "secondary",
  VERIFIED: "default",
  APPROVED: "success",
  PAID: "success",
  CANCELLED: "destructive",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={statusVariant[status] || "secondary"}
      className={status === "PAID" ? "bg-emerald-600 text-white" : undefined}
    >
      {status}
    </Badge>
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

export function PayrollClient({
  contracts,
  salaryRules,
  payslips: initialPayslips,
  batches: initialBatches,
  workEntries: initialWorkEntries,
  adjustments: initialAdjustments,
  summary,
  headcount,
  analysis,
  employees,
  accounts,
}: PayrollClientProps) {
  const router = useRouter();
  const { addToast } = useToast();

  const [payslips, setPayslips] = useState(initialPayslips);
  const [batches, setBatches] = useState(initialBatches);
  const [workEntries, setWorkEntries] = useState(initialWorkEntries);
  const [adjustments, setAdjustments] = useState(initialAdjustments);
  const [localContracts, setLocalContracts] = useState(contracts);

  useEffect(() => {
    setLocalContracts(contracts);
  }, [contracts]);

  useEffect(() => {
    setPayslips(initialPayslips);
  }, [initialPayslips]);

  useEffect(() => {
    setBatches(initialBatches);
  }, [initialBatches]);

  useEffect(() => {
    setWorkEntries(initialWorkEntries);
  }, [initialWorkEntries]);

  useEffect(() => {
    setAdjustments(initialAdjustments);
  }, [initialAdjustments]);

  // ── Dialog States ──
  const [contractOpen, setContractOpen] = useState(false);
  const [contractForm, setContractForm] = useState({
    employeeId: "",
    wageType: "MONTHLY",
    wage: "",
    startDate: "",
    endDate: "",
    schedule: "Monthly",
    structure: "Monthly Employee",
  });
  const [contractLoading, setContractLoading] = useState(false);

  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    code: "",
    name: "",
    category: "ALLOWANCE",
    sequence: 10,
    condition: "True",
    amountFixed: "",
    amountPercent: "",
    basedOn: "contract.wage",
    accountId: "",
  });
  const [ruleLoading, setRuleLoading] = useState(false);

  const [payslipOpen, setPayslipOpen] = useState(false);
  const [payslipForm, setPayslipForm] = useState({
    employeeId: "",
    contractId: "",
    dateFrom: "",
    dateTo: "",
    notes: "",
  });
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [employeeContracts, setEmployeeContracts] = useState<
    { id: string; wage: number; wageType: string }[]
  >([]);

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({ name: "", dateFrom: "", dateTo: "", notes: "" });
  const [batchLoading, setBatchLoading] = useState(false);

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({
    employeeId: "",
    date: "",
    workType: "PRESENT",
    hours: "8",
    dayRate: "",
  });
  const [entryLoading, setEntryLoading] = useState(false);

  const [adjOpen, setAdjOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({
    employeeId: "",
    name: "",
    type: "ALLOWANCE",
    amount: "",
    date: "",
    recurring: false,
  });
  const [adjLoading, setAdjLoading] = useState(false);

  async function api(url: string, options?: RequestInit) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Request failed");
    return json;
  }

  // ── Contract handlers ──
  async function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    setContractLoading(true);
    try {
      const { data } = await api("/api/payroll/contracts", {
        method: "POST",
        body: JSON.stringify({
          employeeId: contractForm.employeeId,
          wageType: contractForm.wageType,
          wage: parseFloat(contractForm.wage),
          startDate: new Date(contractForm.startDate),
          endDate: contractForm.endDate ? new Date(contractForm.endDate) : undefined,
          schedule: contractForm.schedule,
          structure: contractForm.structure,
        }),
      });
      setLocalContracts((prev) => [data, ...prev]);
      addToast({ title: "Contract created", variant: "success" });
      setContractOpen(false);
      setContractForm({
        employeeId: "",
        wageType: "MONTHLY",
        wage: "",
        startDate: "",
        endDate: "",
        schedule: "Monthly",
        structure: "Monthly Employee",
      });
      router.refresh();
    } catch (e: any) {
      addToast({ title: "Error", description: e.message, variant: "error" });
    } finally {
      setContractLoading(false);
    }
  }

  // ── Salary Rule handlers ──
  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    setRuleLoading(true);
    try {
      await api("/api/payroll/rules", {
        method: "POST",
        body: JSON.stringify({
          code: ruleForm.code,
          name: ruleForm.name,
          category: ruleForm.category,
          sequence: Number(ruleForm.sequence),
          condition: ruleForm.condition,
          amountFixed: parseFloat(ruleForm.amountFixed || "0"),
          amountPercent: parseFloat(ruleForm.amountPercent || "0"),
          basedOn: ruleForm.basedOn,
          accountId: ruleForm.accountId || undefined,
        }),
      });
      addToast({ title: "Salary rule created", variant: "success" });
      setRuleOpen(false);
      setRuleForm({
        code: "",
        name: "",
        category: "ALLOWANCE",
        sequence: 10,
        condition: "True",
        amountFixed: "",
        amountPercent: "",
        basedOn: "contract.wage",
        accountId: "",
      });
      router.refresh();
    } catch (e: any) {
      addToast({ title: "Error", description: e.message, variant: "error" });
    } finally {
      setRuleLoading(false);
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      await api(`/api/payroll/rules/${id}`, { method: "DELETE" });
      addToast({ title: "Rule deleted", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error deleting rule", variant: "error" });
    }
  }

  // ── Payslip handlers ──
  async function handleEmployeeChangeForPayslip(employeeId: string) {
    setPayslipForm({ ...payslipForm, employeeId, contractId: "" });
    if (employeeId && employeeId !== "none") {
      try {
        const res = await api(`/api/payroll/contracts?employeeId=${employeeId}`);
        setEmployeeContracts(
          (res.data || []).map((c: any) => ({
            id: c.id,
            wage: Number(c.wage),
            wageType: c.wageType,
          })),
        );
      } catch {
        setEmployeeContracts([]);
      }
    } else {
      setEmployeeContracts([]);
    }
  }

  async function handleCreatePayslip(e: React.FormEvent) {
    e.preventDefault();
    setPayslipLoading(true);
    try {
      await api("/api/payroll/payslips", {
        method: "POST",
        body: JSON.stringify({
          employeeId: payslipForm.employeeId,
          contractId: payslipForm.contractId,
          dateFrom: new Date(payslipForm.dateFrom),
          dateTo: new Date(payslipForm.dateTo),
          notes: payslipForm.notes || undefined,
        }),
      });
      addToast({ title: "Payslip drafted", variant: "success" });
      setPayslipOpen(false);
      setPayslipForm({ employeeId: "", contractId: "", dateFrom: "", dateTo: "", notes: "" });
      router.refresh();
    } catch (e: any) {
      addToast({ title: "Error", description: e.message, variant: "error" });
    } finally {
      setPayslipLoading(false);
    }
  }

  async function handlePayslipStatus(id: string, status: string) {
    try {
      await api(`/api/payroll/payslips/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      addToast({ title: `Payslip ${status.toLowerCase()}`, variant: "success" });
      router.refresh();
    } catch (e: any) {
      addToast({ title: "Error", description: e.message, variant: "error" });
    }
  }

  async function handleDeletePayslip(id: string) {
    try {
      await api(`/api/payroll/payslips/${id}`, { method: "DELETE" });
      addToast({ title: "Payslip deleted", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error deleting payslip", variant: "error" });
    }
  }

  // ── Batch handlers ──
  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    setBatchLoading(true);
    try {
      const { data } = await api("/api/payroll/batches", {
        method: "POST",
        body: JSON.stringify({
          name: batchForm.name,
          dateFrom: new Date(batchForm.dateFrom),
          dateTo: new Date(batchForm.dateTo),
          notes: batchForm.notes || undefined,
        }),
      });
      setBatches((prev) => [data, ...prev]);
      addToast({ title: "Batch created", variant: "success" });
      setBatchOpen(false);
      setBatchForm({ name: "", dateFrom: "", dateTo: "", notes: "" });
      router.refresh();
    } catch (e: any) {
      addToast({ title: "Error", description: e.message, variant: "error" });
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleComputeAll(batchId: string) {
    try {
      const { data } = await api(`/api/payroll/batches/${batchId}`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      const ok = data.filter((r: any) => r.status === "ok").length;
      addToast({ title: `Computed ${ok} payslips`, variant: "success" });
      router.refresh();
    } catch (e: any) {
      addToast({ title: "Error", description: e.message, variant: "error" });
    }
  }

  async function handleBatchStatus(id: string, status: string) {
    try {
      await api(`/api/payroll/batches/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      addToast({ title: `Batch ${status.toLowerCase()}`, variant: "success" });
      router.refresh();
    } catch (e: any) {
      addToast({ title: "Error", description: e.message, variant: "error" });
    }
  }

  async function handleDeleteBatch(id: string) {
    try {
      await api(`/api/payroll/batches/${id}`, { method: "DELETE" });
      setBatches((prev) => prev.filter((b) => b.id !== id));
      addToast({ title: "Batch deleted", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error deleting batch", variant: "error" });
    }
  }

  // ── Work Entry handlers ──
  async function handleCreateEntry(e: React.FormEvent) {
    e.preventDefault();
    setEntryLoading(true);
    try {
      const { data } = await api("/api/payroll/work-entries", {
        method: "POST",
        body: JSON.stringify({
          employeeId: entryForm.employeeId,
          date: new Date(entryForm.date),
          workType: entryForm.workType,
          hours: parseFloat(entryForm.hours || "0"),
          dayRate: parseFloat(entryForm.dayRate || "0"),
        }),
      });
      setWorkEntries((prev) => [data, ...prev]);
      addToast({ title: "Work entry added", variant: "success" });
      setEntryOpen(false);
      setEntryForm({ employeeId: "", date: "", workType: "PRESENT", hours: "8", dayRate: "" });
      router.refresh();
    } catch (e: any) {
      addToast({ title: "Error", description: e.message, variant: "error" });
    } finally {
      setEntryLoading(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    try {
      await api(`/api/payroll/work-entries/${id}`, { method: "DELETE" });
      setWorkEntries((prev) => prev.filter((e) => e.id !== id));
      addToast({ title: "Work entry deleted", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error", variant: "error" });
    }
  }

  // ── Adjustment handlers ──
  async function handleCreateAdjustment(e: React.FormEvent) {
    e.preventDefault();
    setAdjLoading(true);
    try {
      const { data } = await api("/api/payroll/adjustments", {
        method: "POST",
        body: JSON.stringify({
          employeeId: adjForm.employeeId,
          name: adjForm.name,
          type: adjForm.type,
          amount: parseFloat(adjForm.amount),
          date: new Date(adjForm.date),
          recurring: adjForm.recurring,
        }),
      });
      setAdjustments((prev) => [data, ...prev]);
      addToast({ title: "Adjustment created", variant: "success" });
      setAdjOpen(false);
      setAdjForm({
        employeeId: "",
        name: "",
        type: "ALLOWANCE",
        amount: "",
        date: "",
        recurring: false,
      });
      router.refresh();
    } catch (e: any) {
      addToast({ title: "Error", description: e.message, variant: "error" });
    } finally {
      setAdjLoading(false);
    }
  }

  async function handleDeleteAdjustment(id: string) {
    try {
      await api(`/api/payroll/adjustments/${id}`, { method: "DELETE" });
      setAdjustments((prev) => prev.filter((a) => a.id !== id));
      addToast({ title: "Adjustment deleted", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error", variant: "error" });
    }
  }

  const paidAmount = payslips.data.reduce(
    (s, p) => (p.status === "PAID" ? s + Number(p.netPay) : s),
    0,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        description="Contracts, salary rules, payslips, batches, work entries, and adjustments"
      >
        <Button variant="outline" size="sm" onClick={() => setBatchOpen(true)}>
          <Play className="mr-2 h-4 w-4" />
          New Batch
        </Button>
        <Button size="sm" onClick={() => setPayslipOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Draft Payslip
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Active Employees" value={String(headcount.activeEmployees)} />
        <Metric label="Active Contracts" value={String(headcount.activeContracts)} />
        <Metric label="Total Gross" value={formatCurrency(summary.totalGross)} />
        <Metric label="Total Net" value={formatCurrency(summary.totalNet)} />
        <Metric label="Employer Cost" value={formatCurrency(summary.totalEmployerCost)} />
        <Metric label="Paid Out" value={formatCurrency(paidAmount)} />
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="rules">Salary Rules</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="work-entries">Work Entries</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
        </TabsList>

        {/* ─── Dashboard ─── */}
        <TabsContent value="dashboard">
          <Card className="overflow-hidden">
            <SectionHeader
              title="Payroll Dashboard"
              description="Employee contract status, payroll summary, and headcount analysis"
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Wage Type</TableHead>
                    <TableHead>Wage Amount</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Structure</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No contracts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    localContracts.map((c) => {
                      const emp = (c as any).employee;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            {emp?.name || "Unknown"}
                            <p className="text-xs text-muted-foreground">{emp?.email}</p>
                          </TableCell>
                          <TableCell>{c.wageType}</TableCell>
                          <TableCell>{formatCurrency(Number(c.wage))}</TableCell>
                          <TableCell>{c.schedule || "-"}</TableCell>
                          <TableCell>{c.structure || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={c.isActive ? "success" : "destructive"}>
                              {c.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(c.startDate)}</TableCell>
                          <TableCell>{c.endDate ? formatDate(c.endDate) : "Ongoing"}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {analysis.totalByEmployee.length > 0 && (
            <Card className="mt-4 overflow-hidden">
              <SectionHeader
                title="Payroll Analysis"
                description="Top employees by total net pay"
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Payslips</TableHead>
                      <TableHead className="text-right">Total Net Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.totalByEmployee.slice(0, 10).map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell className="text-right">{e.count}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(e.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ─── Contracts ─── */}
        <TabsContent value="contracts">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Payroll Contracts</h2>
                <p className="text-xs text-muted-foreground">
                  Wage, schedule, structure, and employment dates
                </p>
              </div>
              <Button size="sm" onClick={() => setContractOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Contract
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Wage Type</TableHead>
                    <TableHead>Wage Amount</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Structure</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No contracts
                      </TableCell>
                    </TableRow>
                  ) : (
                    localContracts.map((c) => {
                      const emp = (c as any).employee;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{emp?.name || "Unknown"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{c.wageType}</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(Number(c.wage))}</TableCell>
                          <TableCell>{formatDate(c.startDate)}</TableCell>
                          <TableCell>{c.endDate ? formatDate(c.endDate) : "-"}</TableCell>
                          <TableCell>{c.schedule || "-"}</TableCell>
                          <TableCell>{c.structure || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={c.isActive ? "success" : "destructive"}>
                              {c.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Dialog open={contractOpen} onOpenChange={setContractOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Contract</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateContract} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Employee</label>
                  <Select
                    value={contractForm.employeeId || "none"}
                    onValueChange={(v) =>
                      setContractForm({ ...contractForm, employeeId: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select employee</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name || "Unnamed"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Wage Type</label>
                    <Select
                      value={contractForm.wageType}
                      onValueChange={(v) => setContractForm({ ...contractForm, wageType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="HOURLY">Hourly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    label="Wage Amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={contractForm.wage}
                    onChange={(e) => setContractForm({ ...contractForm, wage: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Start Date"
                    type="date"
                    value={contractForm.startDate}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, startDate: e.target.value })
                    }
                    required
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={contractForm.endDate}
                    onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Schedule"
                    value={contractForm.schedule}
                    onChange={(e) => setContractForm({ ...contractForm, schedule: e.target.value })}
                  />
                  <Input
                    label="Structure"
                    value={contractForm.structure}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, structure: e.target.value })
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setContractOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={contractLoading}>
                    {contractLoading ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Salary Rules ─── */}
        <TabsContent value="rules">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Salary Rules</h2>
                <p className="text-xs text-muted-foreground">Rule stack for salary computation</p>
              </div>
              <Button size="sm" onClick={() => setRuleOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Rule
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seq</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Amount / Formula</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No salary rules
                      </TableCell>
                    </TableRow>
                  ) : (
                    salaryRules.map((r) => {
                      const rule = r as any;
                      const formula =
                        rule.amountFixed > 0
                          ? `${formatCurrency(Number(rule.amountFixed))}${rule.amountPercent > 0 ? ` + ${rule.amountPercent}%` : ""}`
                          : rule.amountPercent > 0
                            ? `${rule.amountPercent}% of ${rule.basedOn || "contract.wage"}`
                            : "-";
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{r.sequence}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.code}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.category === "DEDUCTION"
                                  ? "warning"
                                  : r.category === "BASIC"
                                    ? "default"
                                    : "secondary"
                              }
                            >
                              {r.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.condition || "True"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{formula}</TableCell>
                          <TableCell className="text-xs">
                            {rule.account ? `${rule.account.code} ${rule.account.name}` : "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteRule(r.id)}
                              title="Delete rule"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Salary Rule</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateRule} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Code *"
                    value={ruleForm.code}
                    onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value })}
                    required
                  />
                  <Input
                    label="Name *"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      value={ruleForm.category}
                      onValueChange={(v) => setRuleForm({ ...ruleForm, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BASIC">Basic</SelectItem>
                        <SelectItem value="ALLOWANCE">Allowance</SelectItem>
                        <SelectItem value="DEDUCTION">Deduction</SelectItem>
                        <SelectItem value="EMPLOYER_CONTRIBUTION">Employer Contribution</SelectItem>
                        <SelectItem value="NET">Net</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    label="Sequence"
                    type="number"
                    min="0"
                    value={String(ruleForm.sequence)}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, sequence: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <Input
                  label="Condition"
                  value={ruleForm.condition}
                  onChange={(e) => setRuleForm({ ...ruleForm, condition: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Fixed Amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={ruleForm.amountFixed}
                    onChange={(e) => setRuleForm({ ...ruleForm, amountFixed: e.target.value })}
                  />
                  <Input
                    label="Percent (%)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={ruleForm.amountPercent}
                    onChange={(e) => setRuleForm({ ...ruleForm, amountPercent: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Based On</label>
                    <Select
                      value={ruleForm.basedOn}
                      onValueChange={(v) => setRuleForm({ ...ruleForm, basedOn: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contract.wage">Contract Wage</SelectItem>
                        <SelectItem value="gross_pay">Gross Pay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Accounting Account</label>
                    <Select
                      value={ruleForm.accountId || "none"}
                      onValueChange={(v) =>
                        setRuleForm({ ...ruleForm, accountId: v === "none" ? "" : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No account</SelectItem>
                        {accounts
                          .filter((account) => ["EXPENSE", "LIABILITY"].includes(account.type))
                          .map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.code} - {account.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setRuleOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={ruleLoading}>
                    {ruleLoading ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Payslips ─── */}
        <TabsContent value="payslips">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Payslips</h2>
                <p className="text-xs text-muted-foreground">
                  {payslips.total} payslips — page {payslips.page} of {payslips.totalPages}
                </p>
              </div>
              <Button size="sm" onClick={() => setPayslipOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Draft Payslip
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No payslips
                      </TableCell>
                    </TableRow>
                  ) : (
                    payslips.data.map((p) => {
                      const slip = p as any;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {p.number}
                          </TableCell>
                          <TableCell>{slip.employee?.name || "Unknown"}</TableCell>
                          <TableCell className="text-xs">
                            {formatDate(p.dateFrom)} — {formatDate(p.dateTo)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(p.grossPay))}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {formatCurrency(Number(p.totalDeductions))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(p.netPay))}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {p.status === "DRAFT" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => handlePayslipStatus(p.id, "VERIFIED")}
                                    title="Verify"
                                  >
                                    <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => handleDeletePayslip(p.id)}
                                    title="Delete"
                                  >
                                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </>
                              )}
                              {p.status === "VERIFIED" && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handlePayslipStatus(p.id, "APPROVED")}
                                  title="Approve"
                                >
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                </Button>
                              )}
                              {p.status === "APPROVED" && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handlePayslipStatus(p.id, "PAID")}
                                  title="Mark Paid"
                                >
                                  <FileDown className="h-3.5 w-3.5 text-emerald-600" />
                                </Button>
                              )}
                              {p.status !== "PAID" && p.status !== "CANCELLED" && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handlePayslipStatus(p.id, "CANCELLED")}
                                  title="Cancel"
                                >
                                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Dialog open={payslipOpen} onOpenChange={setPayslipOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Draft Payslip</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreatePayslip} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Employee</label>
                  <Select
                    value={payslipForm.employeeId || "none"}
                    onValueChange={(v) => handleEmployeeChangeForPayslip(v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select employee</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name || "Unnamed"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Contract</label>
                  <Select
                    value={payslipForm.contractId || "none"}
                    onValueChange={(v) =>
                      setPayslipForm({ ...payslipForm, contractId: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          employeeContracts.length === 0
                            ? "Select employee first"
                            : "Select contract"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {employeeContracts.length === 0
                          ? "No contracts available"
                          : "Select contract"}
                      </SelectItem>
                      {employeeContracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {formatCurrency(c.wage)} ({c.wageType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Date From"
                    type="date"
                    value={payslipForm.dateFrom}
                    onChange={(e) => setPayslipForm({ ...payslipForm, dateFrom: e.target.value })}
                    required
                  />
                  <Input
                    label="Date To"
                    type="date"
                    value={payslipForm.dateTo}
                    onChange={(e) => setPayslipForm({ ...payslipForm, dateTo: e.target.value })}
                    required
                  />
                </div>
                <Input
                  label="Notes"
                  value={payslipForm.notes}
                  onChange={(e) => setPayslipForm({ ...payslipForm, notes: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setPayslipOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={payslipLoading}>
                    {payslipLoading ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Batches ─── */}
        <TabsContent value="batches">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {batches.length} batch{batches.length !== 1 ? "es" : ""}
            </p>
            <Button size="sm" onClick={() => setBatchOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Batch
            </Button>
          </div>
          {batches.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No batches created yet</Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {batches.map((b) => {
                const batch = b as any;
                const count = batch._count?.payslips || 0;
                return (
                  <Card key={b.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold">{b.name}</h2>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(b.dateFrom)} — {formatDate(b.dateTo)}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <SmallMetric label="Employees" value={String(count)} />
                      <SmallMetric label="Created" value={formatDate(b.createdAt)} />
                      <SmallMetric label="By" value={batch.createdBy?.name || "Unknown"} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {b.status === "DRAFT" && (
                        <Button size="sm" variant="outline" onClick={() => handleComputeAll(b.id)}>
                          <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                          Compute All
                        </Button>
                      )}
                      {b.status === "DRAFT" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBatchStatus(b.id, "VERIFIED")}
                        >
                          <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                          Verify
                        </Button>
                      )}
                      {b.status === "VERIFIED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBatchStatus(b.id, "APPROVED")}
                        >
                          <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                          Approve
                        </Button>
                      )}
                      {b.status === "APPROVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBatchStatus(b.id, "PAID")}
                        >
                          <FileDown className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                          Mark Paid
                        </Button>
                      )}
                      {(b.status === "DRAFT" || b.status === "VERIFIED") && (
                        <Button size="sm" variant="outline" onClick={() => handleDeleteBatch(b.id)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Payroll Batch</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateBatch} className="space-y-4">
                <Input
                  label="Batch Name *"
                  value={batchForm.name}
                  onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Date From"
                    type="date"
                    value={batchForm.dateFrom}
                    onChange={(e) => setBatchForm({ ...batchForm, dateFrom: e.target.value })}
                    required
                  />
                  <Input
                    label="Date To"
                    type="date"
                    value={batchForm.dateTo}
                    onChange={(e) => setBatchForm({ ...batchForm, dateTo: e.target.value })}
                    required
                  />
                </div>
                <Input
                  label="Notes"
                  value={batchForm.notes}
                  onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setBatchOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={batchLoading}>
                    {batchLoading ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Work Entries ─── */}
        <TabsContent value="work-entries">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Work Entries</h2>
                <p className="text-xs text-muted-foreground">
                  Daily attendance, work type, hours, and day rates
                </p>
              </div>
              <Button size="sm" onClick={() => setEntryOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Day Rate</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No work entries
                      </TableCell>
                    </TableRow>
                  ) : (
                    workEntries.map((e) => {
                      const entry = e as any;
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">
                            {entry.employee?.name || "Unknown"}
                          </TableCell>
                          <TableCell>{formatDate(e.date)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{e.workType || "PRESENT"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{e.hours ?? "-"}</TableCell>
                          <TableCell className="text-right">
                            {e.dayRate ? formatCurrency(Number(e.dayRate)) : "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteEntry(e.id)}
                              title="Delete entry"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Work Entry</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateEntry} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Employee</label>
                  <Select
                    value={entryForm.employeeId || "none"}
                    onValueChange={(v) =>
                      setEntryForm({ ...entryForm, employeeId: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select employee</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name || "Unnamed"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  label="Date"
                  type="date"
                  value={entryForm.date}
                  onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
                  required
                />
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Work Type</label>
                    <Select
                      value={entryForm.workType}
                      onValueChange={(v) => setEntryForm({ ...entryForm, workType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRESENT">Present</SelectItem>
                        <SelectItem value="ABSENT">Absent</SelectItem>
                        <SelectItem value="HALF_DAY">Half Day</SelectItem>
                        <SelectItem value="LEAVE">Leave</SelectItem>
                        <SelectItem value="OVERTIME">Overtime</SelectItem>
                        <SelectItem value="HOLIDAY">Holiday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    label="Hours"
                    type="number"
                    min="0"
                    step="0.5"
                    value={entryForm.hours}
                    onChange={(e) => setEntryForm({ ...entryForm, hours: e.target.value })}
                  />
                  <Input
                    label="Day Rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={entryForm.dayRate}
                    onChange={(e) => setEntryForm({ ...entryForm, dayRate: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEntryOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={entryLoading}>
                    {entryLoading ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Adjustments ─── */}
        <TabsContent value="adjustments">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Salary Adjustments</h2>
                <p className="text-xs text-muted-foreground">
                  One-off bonuses, deductions, and recurring adjustments
                </p>
              </div>
              <Button size="sm" onClick={() => setAdjOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Adjustment
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Recurring</TableHead>
                    <TableHead>Payslip</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No adjustments
                      </TableCell>
                    </TableRow>
                  ) : (
                    adjustments.map((a) => {
                      const adj = a as any;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">
                            {adj.employee?.name || "Unknown"}
                          </TableCell>
                          <TableCell>{a.name}</TableCell>
                          <TableCell>
                            <Badge variant={a.type === "DEDUCTION" ? "warning" : "default"}>
                              {a.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(a.amount))}
                          </TableCell>
                          <TableCell>{formatDate(a.date)}</TableCell>
                          <TableCell>
                            {a.recurring ? (
                              <Badge variant="success">Yes</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {adj.payslip ? (
                              <Badge variant="outline">{adj.payslip.number}</Badge>
                            ) : (
                              <span className="text-muted-foreground">Unlinked</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteAdjustment(a.id)}
                              title="Delete adjustment"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Salary Adjustment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateAdjustment} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Employee</label>
                  <Select
                    value={adjForm.employeeId || "none"}
                    onValueChange={(v) =>
                      setAdjForm({ ...adjForm, employeeId: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select employee</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name || "Unnamed"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  label="Name *"
                  value={adjForm.name}
                  onChange={(e) => setAdjForm({ ...adjForm, name: e.target.value })}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Type</label>
                    <Select
                      value={adjForm.type}
                      onValueChange={(v) => setAdjForm({ ...adjForm, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALLOWANCE">Allowance</SelectItem>
                        <SelectItem value="DEDUCTION">Deduction</SelectItem>
                        <SelectItem value="BASIC">Basic</SelectItem>
                        <SelectItem value="EMPLOYER_CONTRIBUTION">Employer Contribution</SelectItem>
                        <SelectItem value="NET">Net</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    label="Amount *"
                    type="number"
                    min="0"
                    step="0.01"
                    value={adjForm.amount}
                    onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Date"
                    type="date"
                    value={adjForm.date}
                    onChange={(e) => setAdjForm({ ...adjForm, date: e.target.value })}
                    required
                  />
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="recurring"
                      checked={adjForm.recurring}
                      onChange={(e) => setAdjForm({ ...adjForm, recurring: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="recurring" className="text-sm font-medium">
                      Recurring
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setAdjOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={adjLoading}>
                    {adjLoading ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
