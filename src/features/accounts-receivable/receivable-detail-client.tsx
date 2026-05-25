"use client";

import { useState, useEffect } from "react";
import { FileText, Send, Printer, Plus, History, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/providers/toast-provider";
import { formatCurrency, formatDate, taxLabel } from "@/lib/utils";
import { CardSkeleton } from "@/components/ui/skeleton";
import { getReceivableDetail, sendPaymentReminder } from "@/actions/accounting";
import { ReceivePaymentDialog } from "./receive-payment-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReceivableDetailClientProps {
  saleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getPaymentStatusVariant(status: string) {
  switch (status) {
    case "PAID": return "success" as const;
    case "PARTIALLY_PAID": return "warning" as const;
    case "UNPAID": return "destructive" as const;
    default: return "secondary" as const;
  }
}

interface PaymentAllocation {
  id: string;
  allocatedAmount: number;
  payment: {
    id: string;
    paymentDate: Date;
    amount: number;
    paymentMethod: string;
    reference: string | null;
    notes: string | null;
  };
}

interface LedgerEntry {
  id: string;
  entryDate: Date;
  type: string;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
}

interface Reminder {
  id: string;
  type: string;
  message: string | null;
  status: string;
  contactMethod: string | null;
  remindedAt: Date | null;
  createdAt: Date;
}

interface SaleDetail {
  id: string;
  invoiceNumber: string;
  total: number;
  paid: number;
  due: number;
  subtotal: number;
  discount: number;
  tax: number;
  paymentStatus: string;
  status: string;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: Date;
  dueDate: Date | null;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
  } | null;
  payments: PaymentAllocation[];
  ledgerEntries: LedgerEntry[];
  reminders: Reminder[];
  items: {
    id: string;
    quantity: number;
    price: any;
    discount: any;
    subtotal: any;
    product: { id: string; name: string; sku: string | null } | null;
  }[];
}

export function ReceivableDetailClient({ saleId, open, onOpenChange }: ReceivableDetailClientProps) {
  const { addToast } = useToast();
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  async function loadDetail() {
    setLoading(true);
    try {
      setDetail(await getReceivableDetail(saleId));
    } catch {
      addToast({ title: "Error loading invoice details", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && saleId) {
      loadDetail();
    }
  }, [open, saleId, addToast]);

  async function handleSendReminder() {
    if (!detail) return;
    if (Number(detail.due) <= 0 || detail.paymentStatus === "PAID") return;
    setSendingReminder(true);
    try {
      await sendPaymentReminder({
        saleId: detail.id,
        customerId: detail.customer?.id,
        type: "PAYMENT_DUE",
        message: `Reminder: Invoice ${detail.invoiceNumber} of ${formatCurrency(detail.due)} is due.`,
        contactMethod: "EMAIL",
      });
      addToast({ title: "Payment reminder sent", variant: "success" });
      await loadDetail();
    } catch {
      addToast({ title: "Error sending reminder", variant: "error" });
    } finally {
      setSendingReminder(false);
    }
  }

  function handlePrint() {
    window.open(`/api/invoices/${saleId}?size=A4`, "_blank", "width=800,height=600");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[min(1200px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {loading ? "Loading..." : `Invoice ${detail?.invoiceNumber || ""}`}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-6">
            <CardSkeleton />
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{detail.invoiceNumber}</h3>
                <p className="text-sm text-muted-foreground">
                  Created on {formatDate(detail.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getPaymentStatusVariant(detail.paymentStatus)} className="text-xs">
                  {detail.paymentStatus.replace("_", " ")}
                </Badge>
                <Badge variant={detail.status === "COMPLETED" ? "success" : "secondary"} className="text-xs">
                  {detail.status.replace("_", " ")}
                </Badge>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Invoice Summary
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{detail.customer?.name || "Walk-in"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(detail.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-medium">{detail.dueDate ? formatDate(detail.dueDate) : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment Status</p>
                  <Badge variant={getPaymentStatusVariant(detail.paymentStatus)} className="text-[10px]">
                    {detail.paymentStatus.replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-medium">{formatCurrency(detail.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="font-medium text-green-600">{formatCurrency(detail.paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance Due</p>
                  <p className="font-bold text-red-600">{formatCurrency(detail.due)}</p>
                </div>
                {detail.paymentMethod && (
                  <div>
                    <p className="text-xs text-muted-foreground">Payment Method</p>
                    <p className="font-medium">{detail.paymentMethod}</p>
                  </div>
                )}
              </div>
            </div>

            {detail.customer && (
              <div className="rounded-lg border p-4">
                <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Customer Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{detail.customer.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{detail.customer.email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{detail.customer.phone || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium">
                      {[detail.customer.address, detail.customer.city].filter(Boolean).join(", ") || "-"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {detail.items && detail.items.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Invoice Items
                </h4>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.product?.name || "Unknown"}
                            {item.product?.sku && (
                              <span className="ml-1 text-xs text-muted-foreground">({item.product.sku})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(item.price))}</TableCell>
                          <TableCell className="text-right">
                            {Number(item.discount) > 0 ? formatCurrency(Number(item.discount)) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(item.subtotal))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(detail.subtotal)}</span>
              </div>
              {detail.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-red-500">-{formatCurrency(detail.discount)}</span>
                </div>
              )}
              {detail.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{taxLabel()}</span>
                  <span>{formatCurrency(detail.tax)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatCurrency(detail.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="text-green-600">{formatCurrency(detail.paid)}</span>
              </div>
              {detail.due > 0 && (
                <div className="flex justify-between font-bold text-red-600">
                  <span>Balance Due</span>
                  <span>{formatCurrency(detail.due)}</span>
                </div>
              )}
            </div>

            {detail.due > 0 && (
              <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-red-500" />
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      Outstanding Amount
                    </p>
                  </div>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(detail.due)}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {detail.due > 0 && detail.paymentStatus !== "PAID" && (
                <Button size="sm" onClick={() => setPaymentOpen(true)} disabled={!detail.customer?.id}>
                  <Plus className="mr-2 h-4 w-4" />
                  Receive Payment
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendReminder}
                disabled={
                  sendingReminder ||
                  !detail.customer?.id ||
                  Number(detail.due) <= 0 ||
                  detail.paymentStatus === "PAID"
                }
              >
                <Send className="mr-2 h-4 w-4" />
                {sendingReminder ? "Sending..." : "Send Reminder"}
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print Statement
              </Button>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Note
              </Button>
            </div>

            {detail.payments && detail.payments.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <History className="h-3.5 w-3.5" />
                  Payment History
                </h4>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.payments.map((pa) => (
                        <TableRow key={pa.id}>
                          <TableCell className="text-sm">{formatDate(pa.payment.paymentDate)}</TableCell>
                          <TableCell>{pa.payment.paymentMethod}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {pa.payment.reference || "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(pa.payment.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(pa.allocatedAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {detail.ledgerEntries && detail.ledgerEntries.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Payment Allocation History
                </h4>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.ledgerEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm">{formatDate(entry.entryDate)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {entry.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {entry.description || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(entry.balance > 999999 ? entry.balance : entry.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {detail.reminders && detail.reminders.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Bell className="h-3.5 w-3.5" />
                  Notes / Reminders
                </h4>
                <div className="space-y-2">
                  {detail.reminders.map((reminder) => (
                    <div key={reminder.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium capitalize">{reminder.type.replace("_", " ")}</p>
                        <div className="flex items-center gap-2">
                          {reminder.contactMethod && (
                            <Badge variant="outline" className="text-[10px]">
                              {reminder.contactMethod}
                            </Badge>
                          )}
                          <Badge
                            variant={reminder.status === "SENT" ? "success" : "secondary"}
                            className="text-[10px]"
                          >
                            {reminder.status}
                          </Badge>
                        </div>
                      </div>
                      {reminder.message && (
                        <p className="mt-1 text-muted-foreground">{reminder.message}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reminder.remindedAt ? `Sent: ${formatDate(reminder.remindedAt)}` : `Created: ${formatDate(reminder.createdAt)}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.notes && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="mt-1">{detail.notes}</p>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
      <ReceivePaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        saleId={detail?.id}
        customerId={detail?.customer?.id}
        saleDue={Number(detail?.due || 0)}
        invoiceNumber={detail?.invoiceNumber}
        onSuccess={() => {
          setPaymentOpen(false);
          loadDetail();
        }}
      />
    </Dialog>
  );
}
