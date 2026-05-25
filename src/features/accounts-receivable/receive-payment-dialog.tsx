"use client";

import { useState, useEffect, useMemo } from "react";
import { DollarSign, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/providers/toast-provider";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getReceivables, receivePayment } from "@/actions/accounting";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type OutstandingInvoice = {
  id: string;
  invoiceNumber: string;
  dueDate: Date | null;
  total: number;
  due: number;
  paid: number;
  customerId?: string | null;
};

interface ReceivePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId?: string;
  customerId?: string | null;
  saleDue?: number;
  invoiceNumber?: string;
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "CHEQUE",
  "EASYPAISA",
  "JAZZCASH",
  "ONLINE_TRANSFER",
  "OTHER",
] as const;

export function ReceivePaymentDialog({
  open,
  onOpenChange,
  saleId,
  customerId: preselectedCustomerId,
  saleDue,
  invoiceNumber,
  onSuccess,
}: ReceivePaymentDialogProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (saleId ? [saleId] : []));
  const [customerId, setCustomerId] = useState(preselectedCustomerId || "");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedIds(saleId ? [saleId] : []);
      setCustomerId(preselectedCustomerId || "");
      setPaymentMethod("CASH");
      setAmount("");
      setReference("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      loadInvoices();
    }
  }, [open, saleId, preselectedCustomerId, saleDue, invoiceNumber]);

  async function loadInvoices() {
    try {
      const result = await getReceivables({
        customerId: preselectedCustomerId || undefined,
        pageSize: 100,
      });
      const outstanding = result.data
        .filter((s: any) => Number(s.due) > 0)
        .map((s: any) => ({
          id: s.id,
          invoiceNumber: s.invoiceNumber,
          dueDate: s.dueDate,
          total: Number(s.total),
          due: Number(s.due),
          paid: Number(s.paid),
          customerId: s.customer?.id || s.customerId || null,
        }));
      const selected = saleId ? outstanding.find((invoice) => invoice.id === saleId) : null;
      const fallbackDue = Number(saleDue ?? 0);
      const invoicesWithFallback =
        saleId && !selected && fallbackDue > 0
          ? [
              {
                id: saleId,
                invoiceNumber: invoiceNumber || "Selected invoice",
                dueDate: null,
                total: fallbackDue,
                due: fallbackDue,
                paid: 0,
                customerId: preselectedCustomerId || null,
              },
              ...outstanding,
            ]
          : outstanding;
      setInvoices(invoicesWithFallback);
      if (saleId) {
        const selectedInvoice = selected || invoicesWithFallback.find((invoice) => invoice.id === saleId);
        if (selectedInvoice) {
          setAmount(String(selectedInvoice.due));
          if (!customerId && selectedInvoice.customerId) setCustomerId(selectedInvoice.customerId);
        }
      }
    } catch {
      addToast({ title: "Error loading invoices", variant: "error" });
    }
  }

  const selectedInvoices = useMemo(
    () => invoices.filter((inv) => selectedIds.includes(inv.id)),
    [invoices, selectedIds],
  );

  const totalDue = useMemo(
    () => selectedInvoices.reduce((sum, inv) => sum + inv.due, 0),
    [selectedInvoices],
  );

  const paymentAmount = useMemo(() => {
    const val = parseFloat(amount);
    return isNaN(val) ? 0 : val;
  }, [amount]);
  const amountExceedsDue = totalDue > 0 && paymentAmount > totalDue + 0.01;

  const remainingAllocation = useMemo(() => {
    if (selectedInvoices.length === 0) return 0;
    let allocated = 0;
    for (let i = 0; i < selectedInvoices.length; i++) {
      const isLast = i === selectedInvoices.length - 1;
      const alloc = isLast
        ? paymentAmount - allocated
        : Math.min(selectedInvoices[i].due, paymentAmount - allocated);
      allocated += Math.max(0, alloc);
    }
    return Math.max(0, paymentAmount - allocated);
  }, [paymentAmount, selectedInvoices]);

  function toggleInvoice(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit() {
    if (selectedIds.length === 0) {
      addToast({ title: "Please select at least one invoice", variant: "error" });
      return;
    }
    if (paymentAmount <= 0) {
      addToast({ title: "Payment amount must be positive", variant: "error" });
      return;
    }
    if (amountExceedsDue) {
      addToast({
        title: "Payment amount cannot exceed total due",
        description: `Maximum allowed is ${formatCurrency(totalDue)}.`,
        variant: "error",
      });
      return;
    }

    setLoading(true);
    try {
      await receivePayment({
        customerId: customerId || null,
        saleIds: selectedIds,
        amount: paymentAmount,
        paymentMethod,
        reference: reference || undefined,
        notes: notes || undefined,
        paymentDate,
      });
      addToast({ title: "Payment recorded successfully", variant: "success" });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      addToast({ title: err?.message || "Error recording payment", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  function getPaymentAllocations(): { invoice: OutstandingInvoice; allocated: number }[] {
    if (selectedInvoices.length === 0) return [];
    const allocations: { invoice: OutstandingInvoice; allocated: number }[] = [];
    let remaining = paymentAmount;
    for (let i = 0; i < selectedInvoices.length; i++) {
      const inv = selectedInvoices[i];
      const isLast = i === selectedInvoices.length - 1;
      const alloc = isLast ? remaining : Math.min(inv.due, remaining);
      allocations.push({ invoice: inv, allocated: Math.max(0, alloc) });
      remaining -= alloc;
    }
    return allocations;
  }

  const allocations = getPaymentAllocations();

  const totalAllocated = allocations.reduce((s, a) => s + a.allocated, 0);
  const unallocated = paymentAmount - totalAllocated;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[min(1000px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Receive Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border bg-muted/30 p-4">
            <Label className="mb-1.5 block text-xs text-muted-foreground">Customer</Label>
            <Input
              value={customerId || "Walk-in customer"}
              readOnly
              placeholder="Customer ID (auto-populated)"
              className="h-9 text-sm"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm font-medium">Outstanding Invoices</Label>
              <Badge variant="outline" className="text-xs">
                {selectedIds.length} selected
              </Badge>
            </div>
            <div className="max-h-60 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <span className="sr-only">Select</span>
                    </TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No outstanding invoices
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className={`cursor-pointer ${selectedIds.includes(inv.id) ? "bg-primary/5" : ""}`}
                        onClick={() => toggleInvoice(inv.id)}
                      >
                        <TableCell>
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              selectedIds.includes(inv.id)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input"
                            }`}
                          >
                            {selectedIds.includes(inv.id) && <Check className="h-3 w-3" />}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">
                          {inv.invoiceNumber}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {inv.dueDate ? formatDate(inv.dueDate) : "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(inv.total)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-red-600">
                          {formatCurrency(inv.due)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                Payment Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={totalDue || undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 text-sm"
              />
              {totalDue > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Total due: {formatCurrency(totalDue)}
                </p>
              )}
              {amountExceedsDue && (
                <p className="mt-1 text-xs text-destructive">
                  Payment cannot exceed the selected due amount of {formatCurrency(totalDue)}.
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                Payment Method <span className="text-red-500">*</span>
              </Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Reference Number</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. CHQ-001"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional payment notes..."
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {selectedInvoices.length > 0 && paymentAmount > 0 && (
            <div>
              <Label className="mb-2 block text-sm font-medium">Allocation Across Invoices</Label>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="space-y-2">
                  {allocations.map((alloc) => (
                    <div
                      key={alloc.invoice.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-mono text-xs">{alloc.invoice.invoiceNumber}</span>
                      <div className="flex items-center gap-2">
                        {alloc.invoice.due > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Due: {formatCurrency(alloc.invoice.due)}
                          </span>
                        )}
                        <span
                          className={`font-medium ${
                            alloc.allocated >= alloc.invoice.due
                              ? "text-green-600"
                              : "text-amber-600"
                          }`}
                        >
                          {formatCurrency(alloc.allocated)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Total</span>
                    <span>{formatCurrency(totalAllocated)}</span>
                  </div>
                  {Math.abs(unallocated) > 0.01 && (
                    <div className="flex items-center justify-between text-sm text-red-500">
                      <span>Unallocated</span>
                      <span>{formatCurrency(unallocated)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || selectedIds.length === 0 || paymentAmount <= 0 || amountExceedsDue}>
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Receive Payment
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
