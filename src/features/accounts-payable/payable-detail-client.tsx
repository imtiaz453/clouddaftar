"use client";

import { useState, useEffect } from "react";
import { Printer, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, taxLabel } from "@/lib/utils";
import { CardSkeleton } from "@/components/ui/skeleton";
import { SupplierPaymentDialog } from "./supplier-payment-dialog";

interface PayableDetailClientProps {
  purchaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PayableDetailClient({
  purchaseId,
  open,
  onOpenChange,
  onSuccess,
}: PayableDetailClientProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    if (!open || !purchaseId) return;
    setLoading(true);
    fetch(`/api/accounting/payables/${purchaseId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data);
      })
      .finally(() => setLoading(false));
  }, [purchaseId, open]);

  if (loading)
    return (
      <div className="p-6">
        <CardSkeleton />
      </div>
    );
  if (!data)
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">Failed to load details</div>
    );

  const p = data.purchase;
  const isSettled = Number(p.due) <= 0 || p.paymentStatus === "PAID";
  const payments = (p.payments || []).map((allocation: any) => ({
    id: allocation.id,
    amount: Number(allocation.allocatedAmount ?? allocation.payment?.amount ?? 0),
    paymentMethod: allocation.payment?.paymentMethod || allocation.paymentMethod || "-",
    paymentDate: allocation.payment?.paymentDate || allocation.paymentDate,
    reference: allocation.payment?.reference || allocation.reference,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{p.referenceNumber}</h3>
          <p className="text-sm text-muted-foreground">Created {formatDate(p.createdAt)}</p>
        </div>
        <Badge
          variant={
            p.paymentStatus === "PAID"
              ? "success"
              : p.paymentStatus === "PARTIALLY_PAID"
                ? "warning"
                : "destructive"
          }
        >
          {(p.paymentStatus || p.status).replace("_", " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
        <div>
          <p className="text-muted-foreground">Supplier</p>
          <p className="font-medium">{p.supplier?.name || "—"}</p>
          {p.supplier?.phone && <p className="text-xs text-muted-foreground">{p.supplier.phone}</p>}
        </div>
        <div>
          <p className="text-muted-foreground">Due Date</p>
          <p className="font-medium">{p.dueDate ? formatDate(p.dueDate) : "—"}</p>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(Number(p.subtotal))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Discount</span>
          <span className="text-red-600">-{formatCurrency(Number(p.discount))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{taxLabel()}</span>
          <span>{formatCurrency(Number(p.tax))}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{formatCurrency(Number(p.total))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Paid</span>
          <span className="text-green-600">{formatCurrency(Number(p.paid))}</span>
        </div>
        {Number(p.due) > 0 && (
          <div className="flex justify-between font-medium text-red-600">
            <span>Due</span>
            <span>{formatCurrency(Number(p.due))}</span>
          </div>
        )}
      </div>

      {payments.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Payment History</p>
          <div className="space-y-2">
            {payments.map((pay: any) => (
              <div
                key={pay.id}
                className="flex items-center justify-between rounded-lg border p-2 text-sm"
              >
                <div>
                  <p className="font-medium">{formatCurrency(pay.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {pay.paymentMethod} · {formatDate(pay.paymentDate)}
                  </p>
                </div>
                {pay.reference && (
                  <span className="text-xs text-muted-foreground">{pay.reference}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!isSettled && (
          <Button
            className="flex-1"
            disabled={!p.supplierId}
            onClick={() => {
              setPaymentOpen(true);
            }}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Make Payment
          </Button>
        )}
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => window.open(`/api/purchase-orders/${p.id}?size=A4`, "_blank")}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print PO
        </Button>
      </div>

      <SupplierPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        purchaseId={purchaseId}
        supplierId={p.supplierId}
        purchaseDue={Number(p.due)}
        onSuccess={() => {
          onSuccess?.();
          setPaymentOpen(false);
          onOpenChange(false);
        }}
      />
    </div>
  );
}
