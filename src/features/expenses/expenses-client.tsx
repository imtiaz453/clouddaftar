"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle, Clock, DollarSign, FileText, Plus, ReceiptText, XCircle } from "lucide-react";
import { createExpense, updateExpenseStatus } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { useToast } from "@/providers/toast-provider";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const categories = ["Travel", "Meals", "Fuel", "Office", "Client", "Medical", "Other"];

const statusVariant: Record<
  string,
  "secondary" | "warning" | "success" | "destructive" | "default"
> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  PAID: "default",
};

interface ExpensesClientProps {
  initialData: { data: any[]; summary: Record<string, number> };
  mode: "mine" | "approval";
}

export function ExpensesClient({ initialData, mode }: ExpensesClientProps) {
  const { addToast } = useToast();
  const [expenses, setExpenses] = useState(initialData.data);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    category: "Travel",
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().split("T")[0],
    paidBy: "EMPLOYEE",
    receiptUrl: "",
    notes: "",
  });

  useEffect(() => {
    setExpenses(initialData.data);
  }, [initialData]);

  const summary = useMemo(
    () => ({
      toSubmit: expenses
        .filter((expense) => expense.status === "DRAFT")
        .reduce((sum, expense) => sum + Number(expense.amount), 0),
      underValidation: expenses
        .filter((expense) => expense.status === "SUBMITTED")
        .reduce((sum, expense) => sum + Number(expense.amount), 0),
      toReimburse: expenses
        .filter((expense) => expense.status === "APPROVED")
        .reduce((sum, expense) => sum + Number(expense.amount), 0),
    }),
    [expenses],
  );

  function resetForm() {
    setForm({
      category: "Travel",
      description: "",
      amount: "",
      expenseDate: new Date().toISOString().split("T")[0],
      paidBy: "EMPLOYEE",
      receiptUrl: "",
      notes: "",
    });
  }

  function submitExpense() {
    const amount = Number(form.amount);
    if (!form.description.trim()) {
      addToast({ title: "Description is required", variant: "error" });
      return;
    }
    if (amount <= 0) {
      addToast({ title: "Enter a valid amount", variant: "error" });
      return;
    }

    startTransition(async () => {
      try {
        const expense = await createExpense({ ...form, amount });
        setExpenses((prev) => [expense, ...prev]);
        resetForm();
        setOpen(false);
        addToast({ title: "Expense submitted for approval", variant: "success" });
      } catch (error) {
        addToast({
          title: "Could not submit expense",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "error",
        });
      }
    });
  }

  function changeStatus(id: string, status: "APPROVED" | "REJECTED" | "PAID") {
    startTransition(async () => {
      try {
        const updated = await updateExpenseStatus(id, status);
        setExpenses((prev) => prev.map((expense) => (expense.id === id ? updated : expense)));
        addToast({ title: `Expense ${status.toLowerCase()}`, variant: "success" });
      } catch (error) {
        addToast({
          title: "Could not update expense",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "approval" ? "Accounting Expenses" : "My Expenses"}
        description={
          mode === "approval"
            ? "Review, approve, reject, and mark employee expenses as reimbursed"
            : "Submit work expenses and track approval or reimbursement"
        }
      >
        {mode === "mine" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New Expense</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Category</Label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Expense Date</Label>
                    <Input
                      type="date"
                      value={form.expenseDate}
                      onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Lunch with client, taxi, office supplies..."
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Paid By</Label>
                    <select
                      value={form.paidBy}
                      onChange={(e) => setForm({ ...form, paidBy: e.target.value })}
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="EMPLOYEE">Employee (to reimburse)</option>
                      <option value="COMPANY">Company</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Receipt Link</Label>
                  <Input
                    value={form.receiptUrl}
                    onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
                    placeholder="Optional receipt URL"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitExpense} disabled={pending}>
                  Submit Expense
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">To Submit</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.toSubmit)}</p>
            </div>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Under Validation</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatCurrency(summary.underValidation)}
              </p>
            </div>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">To Reimburse</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.toReimburse)}</p>
            </div>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ReceiptText className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No expenses found</p>
            <p className="text-sm text-muted-foreground">
              {mode === "mine"
                ? "Create your first expense claim."
                : "Submitted employee expenses will appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expense Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Paid By</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  {mode === "approval" && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">{expense.category}</p>
                    </TableCell>
                    <TableCell>{expense.employee?.name || "Employee"}</TableCell>
                    <TableCell>
                      {expense.paidBy === "EMPLOYEE" ? "Employee (to reimburse)" : "Company"}
                    </TableCell>
                    <TableCell>
                      {expense.receiptUrl ? (
                        <a
                          className="text-sm text-primary underline-offset-4 hover:underline"
                          href={expense.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open receipt
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">No receipt</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[expense.status] || "secondary"}>
                        {expense.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    {mode === "approval" && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {expense.status === "SUBMITTED" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => changeStatus(expense.id, "APPROVED")}
                                disabled={pending}
                              >
                                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => changeStatus(expense.id, "REJECTED")}
                                disabled={pending}
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </>
                          )}
                          {expense.status === "APPROVED" && (
                            <Button
                              size="sm"
                              onClick={() => changeStatus(expense.id, "PAID")}
                              disabled={pending}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
