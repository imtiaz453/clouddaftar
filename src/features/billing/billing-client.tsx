"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Check,
  FileText,
  Eye,
  Upload,
  CreditCard,
  Clock,
  AlertCircle,
  Users,
  HardDrive,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface SubscriptionInfo {
  subscription?: {
    id: string;
    status: string;
    billingCycle: string;
    startDate: string;
    endDate: string;
    trialEndDate: string;
    plan: {
      id: string;
      name: string;
      monthlyPrice: number;
      yearlyPrice: number;
      features: string[];
    };
  } | null;
  invoices: any[];
  billingCurrency?: {
    currency: string;
    currencySymbol: string;
    exchangeRate: number;
  };
}

export function BillingClient() {
  const router = useRouter();
  const { addToast } = useToast();
  const [data, setData] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [payDialog, setPayDialog] = useState<{ open: boolean; invoice: any | null }>({
    open: false,
    invoice: null,
  });
  const [payForm, setPayForm] = useState({
    transactionRef: "",
    paymentMethod: "easypaisa",
    notes: "",
    screenshotData: "",
  });
  const [paying, setPaying] = useState(false);
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [subscribing, setSubscribing] = useState(false);
  const [autoRenewToggling, setAutoRenewToggling] = useState(false);

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/overview");
      const d = await res.json();
      if (d.success) setData(d.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  useEffect(() => {
    fetch("/api/billing/subscriptions")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPlans(d.data);
      })
      .catch(() => {});
  }, []);

  const statusVariant: Record<
    string,
    "success" | "warning" | "secondary" | "destructive" | "default"
  > = {
    CONFIRMED: "success",
    SUBMITTED: "default",
    PENDING: "warning",
    REJECTED: "destructive",
    EXPIRED: "secondary",
  };

  async function handleGenerateInvoice() {
    try {
      const res = await fetch("/api/billing/invoices", { method: "POST" });
      const d = await res.json();
      if (d.success) {
        addToast({ title: "Invoice generated", variant: "success" });
        fetchBilling();
      } else throw new Error(d.error);
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed",
        variant: "error",
      });
    }
  }

  async function handleSubscribe(planId: string) {
    setSubscribing(true);
    try {
      const res = await fetch("/api/billing/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle: selectedCycle }),
      });
      const d = await res.json();
      if (d.success) {
        const invoice = d.data?.invoice;
        addToast({
          title: data?.subscription ? "Plan change invoice generated" : "Subscription created",
          description:
            invoice?.status === "PENDING"
              ? "Pay this invoice and upload the transaction proof for Cloud Daftar admin verification."
              : "Your subscription is ready.",
          variant: "success",
        });
        await fetchBilling();
        if (invoice?.status === "PENDING" || invoice?.status === "REJECTED") {
          setPayDialog({ open: true, invoice });
        }
      } else throw new Error(d.error);
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed",
        variant: "error",
      });
    } finally {
      setSubscribing(false);
    }
  }

  async function toggleAutoRenew() {
    if (!sub) return;
    setAutoRenewToggling(true);
    try {
      const res = await fetch("/api/billing/auto-renew", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRenew: !(sub as any).autoRenew }),
      });
      const d = await res.json();
      if (d.success) {
        addToast({ title: "Auto-renew updated", variant: "success" });
        fetchBilling();
      } else throw new Error(d.error);
    } catch {
      addToast({ title: "Error updating auto-renew", variant: "error" });
    } finally {
      setAutoRenewToggling(false);
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleScreenshotFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast({ title: "Please select an image file", variant: "error" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast({ title: "File too large", description: "Maximum 5MB", variant: "error" });
      return;
    }
    setScreenshotUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "paymentScreenshot");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        throw new Error(d.error || "Failed to upload screenshot");
      }

      setPayForm((current) => ({ ...current, screenshotData: d.url }));
      addToast({ title: "Screenshot uploaded", variant: "success" });
    } catch (err) {
      addToast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed to upload screenshot",
        variant: "error",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setScreenshotUploading(false);
    }
  }

  function clearScreenshot() {
    setPayForm({ ...payForm, screenshotData: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payDialog.invoice) return;
    setPaying(true);
    try {
      const res = await fetch("/api/billing/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: payDialog.invoice.id, ...payForm }),
      });
      const d = await res.json();
      if (d.success) {
        addToast({ title: "Payment submitted for verification", variant: "success" });
        setPayDialog({ open: false, invoice: null });
        setPayForm({
          transactionRef: "",
          paymentMethod: "easypaisa",
          notes: "",
          screenshotData: "",
        });
        fetchBilling();
      } else throw new Error(d.error);
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed",
        variant: "error",
      });
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sub = data?.subscription;
  const invoices = data?.invoices || [];
  const paymentActionInvoice = invoices.find(
    (invoice: any) => invoice.status === "PENDING" || invoice.status === "REJECTED",
  );
  const currentPlanId = sub?.plan?.id;
  const currentPlanCode = String((sub?.plan as any)?.code || "").toLowerCase();
  const planLockedUntil =
    sub &&
    currentPlanCode !== "starter" &&
    sub.endDate &&
    new Date(sub.endDate).getTime() > Date.now()
      ? new Date(sub.endDate)
      : null;
  const money = (amount: number | string | null | undefined, currency?: string, symbol?: string) =>
    formatCurrency(amount, currency, symbol);

  function renderPlanCards() {
    return plans.map((plan) => {
      const features =
        typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features;
      const price =
        selectedCycle === "MONTHLY" ? Number(plan.monthlyPrice) : Number(plan.yearlyPrice);
      const isCurrent = currentPlanId === plan.id && sub?.billingCycle === selectedCycle;
      const planChangeLocked = Boolean(planLockedUntil && !isCurrent);
      return (
        <Card
          key={plan.id}
          className={`relative flex flex-col ${plan.code === "business" ? "border-primary shadow-lg" : ""}`}
        >
          {plan.code === "business" && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Popular
              </span>
            </div>
          )}
          <CardContent className="flex flex-1 flex-col p-6">
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">{plan.description}</p>
            <div className="mb-4">
              <span className="text-3xl font-bold">
                {money(price, plan.currency, plan.currencySymbol)}
              </span>
              <span className="text-sm text-muted-foreground">
                /{selectedCycle === "MONTHLY" ? "mo" : "yr"}
              </span>
            </div>
            <div className="mb-4 space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {plan.userLimit} users
              </p>
              <p className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                {plan.storageLimitMB} MB storage
              </p>
            </div>
            <ul className="mb-6 flex-1 space-y-1.5">
              {(Array.isArray(features) ? features : []).map((f: string, i: number) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-auto w-full"
              onClick={() => handleSubscribe(plan.id)}
              disabled={subscribing || isCurrent || planChangeLocked}
              variant={plan.code === "free" || isCurrent ? "outline" : "default"}
            >
              {subscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isCurrent
                ? "Current Plan"
                : planChangeLocked
                  ? `Available ${planLockedUntil?.toLocaleDateString()}`
                  : sub
                    ? `Switch to ${money(price, plan.currency, plan.currencySymbol)}/${selectedCycle === "MONTHLY" ? "mo" : "yr"}`
                    : plan.code === "free"
                      ? "Start Free"
                      : `Subscribe ${money(price, plan.currency, plan.currencySymbol)}/${selectedCycle === "MONTHLY" ? "mo" : "yr"}`}
            </Button>
          </CardContent>
        </Card>
      );
    });
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Plan</span>
            {sub && (
              <Badge
                variant={
                  sub.status === "ACTIVE" || sub.status === "TRIAL" ? "success" : "destructive"
                }
              >
                {sub.status}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!sub ? (
            <div className="space-y-6 py-6">
              <div className="text-center">
                <p className="text-muted-foreground">
                  Choose a plan to get started. Your subscription starts with a 14-day trial.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCycle("MONTHLY")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${selectedCycle === "MONTHLY" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCycle("YEARLY")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${selectedCycle === "YEARLY" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                >
                  Yearly <span className="text-xs opacity-80">(save ~17%)</span>
                </button>
              </div>
              <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {renderPlanCards()}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="text-lg font-semibold">{sub.plan?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Billing Cycle</p>
                  <p className="text-lg font-semibold">
                    {sub.billingCycle === "MONTHLY" ? "Monthly" : "Yearly"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-lg font-semibold">
                    {money(
                      sub.billingCycle === "MONTHLY"
                        ? Number(sub.plan?.monthlyPrice || 0)
                        : Number(sub.plan?.yearlyPrice || 0),
                      (sub.plan as any)?.currency,
                      (sub.plan as any)?.currencySymbol,
                    )}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{sub.billingCycle === "MONTHLY" ? "mo" : "yr"}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expires</p>
                  <p className="text-lg font-semibold">
                    {sub.endDate ? new Date(sub.endDate).toLocaleDateString() : "N/A"}
                  </p>
                </div>
                {sub.trialEndDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Trial Ends</p>
                    <p className="text-lg font-semibold">
                      {new Date(sub.trialEndDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 border-t pt-2">
                <button
                  type="button"
                  onClick={toggleAutoRenew}
                  disabled={autoRenewToggling}
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {(sub as any).autoRenew ? (
                    <ToggleRight className="h-5 w-5 text-primary" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                  <span className="font-medium">
                    Auto-renew {(sub as any).autoRenew ? "ON" : "OFF"}
                  </span>
                </button>
                <p className="text-xs text-muted-foreground">
                  {autoRenewToggling
                    ? "Updating..."
                    : (sub as any).autoRenew
                      ? "New invoice will be generated automatically on expiry"
                      : "You'll need to manually renew on expiry"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {sub && plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {planLockedUntil && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                Your current paid plan is locked until{" "}
                <span className="font-semibold">{planLockedUntil.toLocaleDateString()}</span>. Plan
                changes will unlock after this billing period ends.
              </div>
            )}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCycle("MONTHLY")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${selectedCycle === "MONTHLY" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setSelectedCycle("YEARLY")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${selectedCycle === "YEARLY" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                Yearly <span className="text-xs opacity-80">(save ~17%)</span>
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{renderPlanCards()}</div>
          </CardContent>
        </Card>
      )}

      {paymentActionInvoice && (
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold">Payment verification required</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Invoice {paymentActionInvoice.invoiceNumber} is{" "}
                {paymentActionInvoice.status.toLowerCase()}. Pay using the instructions below, then
                upload the transaction proof so Cloud Daftar admin can verify and approve it.
              </p>
            </div>
            <Button
              className="shrink-0"
              onClick={() => setPayDialog({ open: true, invoice: paymentActionInvoice })}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload proof
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Payment Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 font-semibold">Easypaisa</h3>
              <p className="text-2xl font-bold text-primary">03495940892</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 font-semibold">Bank Transfer (ABL)</h3>
              <p className="text-sm">
                <span className="text-muted-foreground">Title:</span> IMTIAZ AHMED
              </p>
              <p className="font-mono text-sm font-bold">51520020136028930017</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            After payment, submit the transaction details below. Our team will verify and activate
            your subscription.
          </p>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Billing History</span>
            {(!sub || sub.status === "EXPIRED" || sub.status === "TRIAL") && (
              <Button size="sm" onClick={handleGenerateInvoice}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Invoice
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No invoices yet</p>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                      <TableCell>{inv.plan?.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(inv.periodStart).toLocaleDateString()} -{" "}
                        {new Date(inv.periodEnd).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {money(Number(inv.amount), inv.currency, inv.currencySymbol)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[inv.status] || "secondary"}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="View invoice"
                            onClick={() =>
                              window.open(
                                `/api/billing/invoices/${inv.id}`,
                                "_blank",
                                "width=800,height=600",
                              )
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {(inv.status === "PENDING" || inv.status === "REJECTED") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary"
                              title="Submit payment"
                              onClick={() => setPayDialog({ open: true, invoice: inv })}
                            >
                              <Upload className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={payDialog.open} onOpenChange={(open) => setPayDialog({ ...payDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Payment</DialogTitle>
            <DialogDescription>
              Invoice: {payDialog.invoice?.invoiceNumber} -{" "}
              {money(
                Number(payDialog.invoice?.amount || 0),
                payDialog.invoice?.currency,
                payDialog.invoice?.currencySymbol,
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Payment Method</label>
              <select
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="easypaisa">Easypaisa</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="jazzcash">JazzCash</option>
              </select>
            </div>
            <Input
              label="Transaction Reference"
              value={payForm.transactionRef}
              onChange={(e) => setPayForm({ ...payForm, transactionRef: e.target.value })}
              placeholder="TXN ID or reference number"
              required
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium">Payment Screenshot</label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotFile}
                  disabled={screenshotUploading}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
                />
                {screenshotUploading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {payForm.screenshotData && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={clearScreenshot}
                    title="Clear"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {payForm.screenshotData ? (
                <div className="mt-2 max-h-48 overflow-hidden rounded-lg border">
                  <img
                    src={payForm.screenshotData}
                    alt="Payment screenshot preview"
                    className="max-h-48 w-full bg-muted object-contain"
                  />
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload a screenshot of the payment confirmation (max 5MB)
                </p>
              )}
            </div>
            <Input
              label="Notes"
              value={payForm.notes}
              onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
              placeholder="Optional notes..."
            />
            <Button type="submit" className="w-full" disabled={paying || screenshotUploading}>
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Upload className="mr-2 h-4 w-4" />
              Submit for Verification
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
