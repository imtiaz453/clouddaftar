"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Building, Mail, Phone, MapPin, Calendar, Users, Package, ShoppingCart, Pencil, KeyRound } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/providers/toast-provider";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export default function AdminTenantDetailPage() {
  const params = useParams();
  const tenantId = params?.id as string;
  const { addToast } = useToast();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [extendDialog, setExtendDialog] = useState(false);
  const [planDialog, setPlanDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [companyForm, setCompanyForm] = useState({ name: "", email: "", phone: "", city: "", state: "" });
  const [days, setDays] = useState("30");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [processing, setProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ open: boolean; action: "suspend" | "reactivate" | null }>({ open: false, action: null });

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`);
      const d = await res.json();
      if (d.success) setCompany(d.data);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/plans");
      const d = await res.json();
      if (d.success) setPlans(d.data);
    } catch {}
  }, []);

  useEffect(() => { fetchCompany(); fetchPlans(); }, [fetchCompany, fetchPlans]);

  async function handleAction(action: string, extra?: Record<string, any>) {
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      if (d.success) {
        addToast({ title: "Success", variant: "success" });
        setConfirmAction({ open: false, action: null });
        setExtendDialog(false);
        setPlanDialog(false);
        setEditDialog(false);
        setPasswordDialog(false);
        setNewPassword("");
        fetchCompany();
      } else throw new Error(d.error);
    } catch (err) {
      addToast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally { setProcessing(false); }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><LoadingSpinner size={8} /></div>;
  }

  if (!company) {
    return <div className="text-center py-12 text-muted-foreground">Company not found</div>;
  }

  const sub = company.subscription;
  function openEditCompany() {
    setCompanyForm({
      name: company.name || "",
      email: company.email || "",
      phone: company.phone || "",
      city: company.city || "",
      state: company.state || "",
    });
    setEditDialog(true);
  }

  function openPasswordReset(member: any) {
    setSelectedUser(member.user);
    setNewPassword("");
    setPasswordDialog(true);
  }
  const invoiceMoney = (inv: any) =>
    formatCurrency(
      Number(inv.amount || 0),
      inv.currency || company.currency || "PKR",
      inv.currencySymbol || company.currencySymbol || "Rs",
    );
  const platformMoney = (amount: number) => formatCurrency(amount, "PKR", "Rs");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/cloud-daftar-admin/tenants">
          <Button variant="ghost" size="icon" title="Back to tenants"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
            <Badge variant={company.isActive ? "success" : "destructive"}>{company.isActive ? "Active" : "Inactive"}</Badge>
          </div>
          <p className="text-muted-foreground">{company.slug}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium"><Building className="inline h-4 w-4 mr-2" />Company Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {company.email && <p><Mail className="inline h-3 w-3 mr-2 text-muted-foreground" />{company.email}</p>}
            {company.phone && <p><Phone className="inline h-3 w-3 mr-2 text-muted-foreground" />{company.phone}</p>}
            {company.city && <p><MapPin className="inline h-3 w-3 mr-2 text-muted-foreground" />{company.city}, {company.state}</p>}
            <p><Calendar className="inline h-3 w-3 mr-2 text-muted-foreground" />Joined {new Date(company.createdAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {sub ? (
              <>
                <p>Plan: <span className="font-medium">{sub.plan?.name}</span></p>
                <div>Status: <Badge variant={sub.status === "ACTIVE" ? "success" : sub.status === "TRIAL" ? "default" : "destructive"}>{sub.status}</Badge></div>
                <p>Cycle: <span className="capitalize">{sub.billingCycle?.toLowerCase()}</span></p>
                <p>Expires: {sub.endDate ? new Date(sub.endDate).toLocaleDateString() : "N/A"}</p>
                {sub.trialEndDate && <p>Trial ends: {new Date(sub.trialEndDate).toLocaleDateString()}</p>}
              </>
            ) : <p className="text-muted-foreground">No subscription</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Stats</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><Users className="inline h-3 w-3 mr-1 text-muted-foreground" />{company._count.members} members</div>
              <div><Package className="inline h-3 w-3 mr-1 text-muted-foreground" />{company._count.products} products</div>
              <div><ShoppingCart className="inline h-3 w-3 mr-1 text-muted-foreground" />{company._count.sales} sales</div>
              <div>{company._count.customers || 0} customers</div>
              <div>{company._count.purchases || 0} purchases</div>
              <div>{company._count.suppliers || 0} suppliers</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {sub?.status === "ACTIVE" && (
          <Button variant="destructive" onClick={() => setConfirmAction({ open: true, action: "suspend" })}>Suspend</Button>
        )}
        {(sub?.status === "SUSPENDED" || sub?.status === "EXPIRED") && (
          <Button variant="default" onClick={() => setConfirmAction({ open: true, action: "reactivate" })}>Reactivate</Button>
        )}
        <Button variant="outline" onClick={() => setExtendDialog(true)}>Extend Subscription</Button>
        <Button variant="outline" onClick={() => { setSelectedPlanId(sub?.planId || ""); setPlanDialog(true); }}>Change Plan</Button>
        <Button variant="outline" onClick={openEditCompany}><Pencil className="mr-2 h-4 w-4" />Edit Tenant Info</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Invoices ({company.invoices?.length || 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(!company.invoices || company.invoices.length === 0) ? (
            <p className="px-6 pb-4 text-muted-foreground text-sm">No invoices</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.invoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.plan?.name}</TableCell>
                    <TableCell className="font-medium">{invoiceMoney(inv)}</TableCell>
                    <TableCell><Badge variant={inv.status === "CONFIRMED" ? "success" : inv.status === "SUBMITTED" ? "default" : inv.status === "REJECTED" ? "destructive" : "warning"}>{inv.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(inv.periodStart).toLocaleDateString()} - {new Date(inv.periodEnd).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs">{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Team Members ({company.members?.length || 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(!company.members || company.members.length === 0) ? (
            <p className="px-6 pb-4 text-muted-foreground text-sm">No members</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.members.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.user?.name || "N/A"}</TableCell>
                    <TableCell>{m.user?.email}</TableCell>
                    <TableCell>{m.role}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openPasswordReset(m)}>
                        <KeyRound className="mr-2 h-3.5 w-3.5" />Reset Password
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirm Action Dialog */}
      <Dialog open={confirmAction.open} onOpenChange={(open) => setConfirmAction({ ...confirmAction, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction.action === "suspend" ? "Suspend Company" : "Reactivate Company"}</DialogTitle>
            <DialogDescription>
              {confirmAction.action === "suspend"
                ? "This will suspend the company and their subscription. They will not be able to access the platform."
                : "This will reactivate the company and their subscription."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmAction({ open: false, action: null })}>Cancel</Button>
            <Button
              variant={confirmAction.action === "suspend" ? "destructive" : "default"}
              onClick={() => handleAction(confirmAction.action!)}
              disabled={processing}
            >
              {processing && <LoadingSpinner size={4} className="mr-2" />}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={extendDialog} onOpenChange={setExtendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Subscription</DialogTitle>
            <DialogDescription>Add extra days to the subscription period</DialogDescription>
          </DialogHeader>
          <Input label="Days to extend" type="number" value={days} onChange={(e) => setDays(e.target.value)} required />
          <Button onClick={() => handleAction("extend", { days: Number(days) })} disabled={processing} className="w-full">
            {processing && <LoadingSpinner size={4} className="mr-2" />}
            Extend by {days} days
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tenant Information</DialogTitle>
            <DialogDescription>Update the company profile shown across the tenant workspace.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Company name" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
            <Input label="Email" type="email" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} />
            <Input label="Phone" value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} />
            <Input label="City" value={companyForm.city} onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })} />
            <Input label="State" value={companyForm.state} onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })} />
          </div>
          <Button onClick={() => handleAction("update-info", companyForm)} disabled={processing || !companyForm.name.trim()} className="w-full">
            {processing && <LoadingSpinner size={4} className="mr-2" />}
            Save Tenant Information
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Tenant User Password</DialogTitle>
            <DialogDescription>
              Set a temporary password for {selectedUser?.email}. This action is recorded in the system audit log.
            </DialogDescription>
          </DialogHeader>
          <Input label="Temporary password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
          <Button
            onClick={() => handleAction("reset-user-password", { userId: selectedUser?.id, newPassword })}
            disabled={processing || !selectedUser?.id || newPassword.length < 8}
            className="w-full"
          >
            {processing && <LoadingSpinner size={4} className="mr-2" />}
            Reset Password
          </Button>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>Switch the company to a different plan</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {plans.map((plan) => (
              <label key={plan.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selectedPlanId === plan.id ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
                <input type="radio" name="plan" value={plan.id} checked={selectedPlanId === plan.id} onChange={(e) => setSelectedPlanId(e.target.value)} className="h-4 w-4" />
                <div>
                  <p className="font-medium text-sm">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">{plan.description} - {platformMoney(Number(plan.monthlyPrice))}/mo</p>
                </div>
              </label>
            ))}
          </div>
          <Button onClick={() => handleAction("change-plan", { planId: selectedPlanId })} disabled={processing || !selectedPlanId} className="w-full">
            {processing && <LoadingSpinner size={4} className="mr-2" />}
            Change Plan
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
