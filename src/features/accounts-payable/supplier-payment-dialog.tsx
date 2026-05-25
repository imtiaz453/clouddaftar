"use client";

import { useState, useEffect } from "react";
import { DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";

interface SupplierPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseId?: string;
  supplierId?: string;
  purchaseDue?: number;
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "EASYPAISA", label: "Easypaisa" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "ONLINE_TRANSFER", label: "Online Transfer" },
];

export function SupplierPaymentDialog({ open, onOpenChange, purchaseId, supplierId, purchaseDue, onSuccess }: SupplierPaymentDialogProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount(""); setReference(""); setNotes(""); setSelectedIds([]);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setLoading(true);
    const params = new URLSearchParams();
    if (purchaseId) params.set("purchaseId", purchaseId);
    if (supplierId) params.set("supplierId", supplierId);
    params.set("status", "UNPAID,PARTIALLY_PAID");
    fetch(`/api/accounting/payables?${params}&pageSize=50`).then(r => r.json()).then(d => {
      if (d.success) {
        setInvoices(d.data.data);
        if (purchaseId) {
          setSelectedIds([purchaseId]);
          const inv = d.data.data.find((i: any) => i.id === purchaseId);
          const due = Number(inv?.balance ?? inv?.due ?? purchaseDue ?? 0);
          if (due > 0) setAmount(String(due));
        }
      }
    }).finally(() => setLoading(false));
  }, [open, purchaseId, supplierId, purchaseDue]);

  const totalSelected = invoices
    .filter(i => selectedIds.includes(i.id))
    .reduce((s, i) => s + Number(i.balance ?? i.due ?? 0), 0) || (purchaseId ? Number(purchaseDue ?? 0) : 0);
  const payAmount = parseFloat(amount) || 0;
  const amountExceedsDue = totalSelected > 0 && payAmount > totalSelected + 0.01;

  const handleSubmit = async () => {
    if (selectedIds.length === 0) { addToast({ title: "Select at least one invoice", variant: "error" }); return; }
    if (!supplierId) { addToast({ title: "Supplier is missing for this payable", variant: "error" }); return; }
    if (payAmount <= 0) { addToast({ title: "Enter a valid amount", variant: "error" }); return; }
    if (amountExceedsDue) {
      addToast({
        title: "Amount exceeds total due",
        description: `Maximum allowed is ${formatCurrency(totalSelected)}.`,
        variant: "error",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/accounting/payables/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, purchaseIds: selectedIds, amount: payAmount, paymentMethod, reference, paymentDate, notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Payment failed");
      }
      addToast({ title: "Payment recorded successfully", variant: "success" });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      addToast({
        title: "Error processing payment",
        description: error instanceof Error ? error.message : "Failed",
        variant: "error",
      });
    }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[min(900px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Pay Supplier</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!purchaseId && (
            <div>
              <Label>Select Invoices</Label>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : invoices.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No unpaid invoices found</p>
              ) : (
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {invoices.map((inv) => (
                    <label key={inv.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm hover:bg-muted">
                      <input type="checkbox" checked={selectedIds.includes(inv.id)} onChange={() => {
                        setSelectedIds(prev => prev.includes(inv.id) ? prev.filter(i => i !== inv.id) : [...prev, inv.id]);
                      }} />
                      <div className="flex-1">
                        <p className="font-medium">{inv.referenceNumber}</p>
                        <p className="text-xs text-muted-foreground">Due: {inv.dueDate ? formatDate(inv.dueDate) : "N/A"}</p>
                      </div>
                      <span className="font-medium text-red-600">{formatCurrency(Number(inv.balance ?? inv.due ?? 0))}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {totalSelected > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="flex justify-between"><span>Total Due (selected)</span><span className="font-bold text-red-600">{formatCurrency(totalSelected)}</span></div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label>Payment Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={totalSelected || undefined}
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              {amountExceedsDue && (
                <p className="mt-1 text-xs text-destructive">
                  Payment cannot exceed the selected due amount of {formatCurrency(totalSelected)}.
                </p>
              )}
            </div>
            <div>
              <Label>Payment Method</Label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Reference #</Label>
                <Input placeholder="Optional" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
              <div>
                <Label>Payment Date</Label>
                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <textarea rows={2} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || loading || payAmount <= 0 || selectedIds.length === 0 || amountExceedsDue}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
