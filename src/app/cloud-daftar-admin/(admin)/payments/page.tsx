"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check, X, ChevronLeft, ChevronRight, Eye, Search, ExternalLink, FileImage, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Payment {
  id: string; invoiceNumber: string; amount: number; status: string;
  currency?: string | null; currencySymbol?: string | null;
  periodStart: string; periodEnd: string; createdAt: string; paidAt: string | null;
  company: { name: string; slug: string; logo: string | null; currency?: string | null; currencySymbol?: string | null };
  plan: { name: string };
  payment: { id: string; transactionRef: string | null; paymentMethod: string; screenshotUrl: string | null; notes: string | null; submittedAt: string } | null;
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [tab, setTab] = useState("pending");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; payment: Payment | null; action: "confirm" | "reject" | null }>({ open: false, payment: null, action: null });
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchPayments = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const filter = tab === "pending" ? "pending" : "all";
      const res = await fetch(`/api/admin/payments?page=${p}&filter=${filter}`);
      const d = await res.json();
      if (d.success) {
        setPayments(d.data.data);
        setTotal(d.data.total);
        setTotalPages(d.data.totalPages);
        setPage(d.data.page);
      }
    } catch {} finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchPayments(1); setPage(1); }, [fetchPayments]);

  async function handleDelete(payment: Payment) {
    if (!confirm(`Delete invoice ${payment.invoiceNumber}? This cannot be undone.`)) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: payment.id }),
      });
      const d = await res.json();
      if (d.success) {
        addToast({ title: "Invoice deleted", variant: "success" });
        await fetchPayments(page);
        router.refresh();
      } else throw new Error(d.error);
    } catch (err) {
      addToast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally { setProcessing(false); }
  }

  async function handleAction() {
    if (!actionDialog.payment || !actionDialog.action) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: actionDialog.payment.id, action: actionDialog.action, notes: adminNotes }),
      });
      const d = await res.json();
      if (d.success) {
        addToast({ title: actionDialog.action === "confirm" ? "Payment confirmed" : "Payment rejected", variant: "success" });
        setActionDialog({ open: false, payment: null, action: null });
        setAdminNotes("");
        await fetchPayments(page);
        router.refresh();
      } else throw new Error(d.error);
    } catch (err) {
      addToast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally { setProcessing(false); }
  }

  const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive" | "default"> = {
    CONFIRMED: "success", SUBMITTED: "default", PENDING: "warning", REJECTED: "destructive", EXPIRED: "secondary",
  };
  const invoiceCurrency = (payment?: Payment | null) => ({
    currency: payment?.currency || payment?.company?.currency || "PKR",
    symbol: payment?.currencySymbol || payment?.company?.currencySymbol || "Rs",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment Management</h1>
        <p className="text-muted-foreground">Review and verify payment submissions</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v)}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({total})</TabsTrigger>
          <TabsTrigger value="all">All Payments</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : payments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No payments found</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-28">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.invoiceNumber}</TableCell>
                          <TableCell className="font-medium">{p.company?.name}</TableCell>
                          <TableCell>{p.plan?.name}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(Number(p.amount), invoiceCurrency(p).currency, invoiceCurrency(p).symbol)}</TableCell>
                          <TableCell className="text-xs capitalize">{p.payment?.paymentMethod?.replace("_", " ") || "-"}</TableCell>
                          <TableCell><Badge variant={statusVariant[p.status] || "secondary"}>{p.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {p.status === "SUBMITTED" ? (
                                <>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Confirm payment"
                                    onClick={() => setActionDialog({ open: true, payment: p, action: "confirm" })}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Reject payment"
                                    onClick={() => setActionDialog({ open: true, payment: p, action: "reject" })}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="View payment"
                                  onClick={() => setActionDialog({ open: true, payment: p, action: null })}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              {p.status !== "CONFIRMED" && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete payment"
                                  onClick={() => handleDelete(p)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({total} total)</p>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchPayments(page - 1)} title="Previous page">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => fetchPayments(page + 1)} title="Next page">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === "confirm" ? "Confirm Payment" : actionDialog.action === "reject" ? "Reject Payment" : "Payment Details"}
            </DialogTitle>
            <DialogDescription>
              Invoice: {actionDialog.payment?.invoiceNumber} - {formatCurrency(Number(actionDialog.payment?.amount || 0), invoiceCurrency(actionDialog.payment).currency, invoiceCurrency(actionDialog.payment).symbol)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Invoice Info */}
            <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between text-sm">
              <span>
                <span className="text-muted-foreground">Company:</span>{" "}
                <span className="font-medium">{actionDialog.payment?.company?.name}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Plan:</span>{" "}
                <span className="font-medium">{actionDialog.payment?.plan?.name}</span>
              </span>
            </div>

            {/* Payment Proof */}
            {actionDialog.payment?.payment ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <FileImage className="h-4 w-4" />
                  Payment Proof Submitted
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between items-center py-1.5 border-b border-primary/10">
                    <span className="text-muted-foreground">Transaction ID</span>
                    <span className="font-mono font-medium text-base">
                      {actionDialog.payment.payment.transactionRef || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-primary/10">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="font-medium capitalize">
                      {actionDialog.payment.payment.paymentMethod.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-primary/10">
                    <span className="text-muted-foreground">Submitted At</span>
                    <span className="font-medium">
                      {new Date(actionDialog.payment.payment.submittedAt).toLocaleString()}
                    </span>
                  </div>
                  {actionDialog.payment.payment.notes && (
                    <div className="py-1.5 border-b border-primary/10">
                      <span className="text-muted-foreground block mb-1">Notes from Tenant</span>
                      <p className="text-sm bg-background rounded p-2">{actionDialog.payment.payment.notes}</p>
                    </div>
                  )}
                  {actionDialog.payment.payment.screenshotUrl ? (
                    <div className="pt-1">
                      <span className="text-muted-foreground block mb-2">Screenshot</span>
                      {actionDialog.payment.payment.screenshotUrl.startsWith("data:") ||
                      actionDialog.payment.payment.screenshotUrl.startsWith("blob:") ? (
                        <img
                          src={actionDialog.payment.payment.screenshotUrl}
                          alt="Payment Screenshot"
                          className="max-h-64 w-full object-contain rounded-lg border bg-background"
                        />
                      ) : (
                        <a
                          href={actionDialog.payment.payment.screenshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Screenshot
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="py-1.5">
                      <span className="text-muted-foreground text-xs">No screenshot uploaded</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No payment proof submitted yet
              </div>
            )}

            {actionDialog.action && (
              <>
                <Input label="Admin Notes (optional)" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Add a note about this verification..." />
                <div className="flex gap-2">
                  <Button
                    onClick={handleAction}
                    className="flex-1"
                    variant={actionDialog.action === "confirm" ? "default" : "destructive"}
                    disabled={processing}
                  >
                    {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {actionDialog.action === "confirm" ? (
                      <><Check className="mr-2 h-4 w-4" /> Confirm Payment</>
                    ) : (
                      <><X className="mr-2 h-4 w-4" /> Reject Payment</>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
