"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Pencil, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Plan {
  id: string; name: string; code: string; description: string | null;
  monthlyPrice: number; yearlyPrice: number;
  userLimit: number; storageLimitMB: number;
  features: string[]; isActive: boolean; sortOrder: number;
}

export default function AdminPlansPage() {
  const { addToast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; plan?: Plan }>({ open: false });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", description: "", monthlyPrice: "", yearlyPrice: "",
    userLimit: "5", storageLimitMB: "500", features: "", sortOrder: "0", isActive: true,
  });

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/plans");
      const d = await res.json();
      if (d.success) setPlans(d.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  function openCreate() {
    setForm({ name: "", code: "", description: "", monthlyPrice: "", yearlyPrice: "", userLimit: "5", storageLimitMB: "500", features: "", sortOrder: "0", isActive: true });
    setDialog({ open: true });
  }

  function openEdit(plan: Plan) {
    const features = Array.isArray(plan.features) ? plan.features.join("\n") : "";
    setForm({
      name: plan.name, code: plan.code, description: plan.description || "",
      monthlyPrice: String(plan.monthlyPrice), yearlyPrice: String(plan.yearlyPrice),
      userLimit: String(plan.userLimit), storageLimitMB: String(plan.storageLimitMB),
      features, sortOrder: String(plan.sortOrder), isActive: plan.isActive,
    });
    setDialog({ open: true, plan });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        monthlyPrice: Number(form.monthlyPrice),
        yearlyPrice: Number(form.yearlyPrice),
        userLimit: Number(form.userLimit),
        storageLimitMB: Number(form.storageLimitMB),
        sortOrder: Number(form.sortOrder),
        features: form.features.split("\n").filter(Boolean),
      };

      const url = "/api/admin/plans";
      const method = dialog.plan ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dialog.plan ? { id: dialog.plan.id, ...body } : body),
      });
      const d = await res.json();
      if (d.success) {
        addToast({ title: dialog.plan ? "Plan updated" : "Plan created", variant: "success" });
        setDialog({ open: false });
        fetchPlans();
      } else throw new Error(d.error);
    } catch (err) {
      addToast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally { setSaving(false); }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  const platformMoney = (amount: number) => formatCurrency(amount, "PKR", "Rs");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription Plans</h1>
          <p className="text-muted-foreground">Manage pricing plans and features</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Plan</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Yearly</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No plans yet</TableCell>
                </TableRow>
              ) : plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.code}</p>
                  </TableCell>
                  <TableCell className="font-medium">{platformMoney(Number(plan.monthlyPrice))}</TableCell>
                  <TableCell className="font-medium">{platformMoney(Number(plan.yearlyPrice))}</TableCell>
                  <TableCell><Users className="inline h-3 w-3 mr-1" />{plan.userLimit}</TableCell>
                  <TableCell>{plan.storageLimitMB} MB</TableCell>
                  <TableCell><Badge variant={plan.isActive ? "success" : "secondary"}>{plan.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>{plan.sortOrder}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(plan)} title="Edit plan">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ ...dialog, open })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog.plan ? "Edit Plan" : "Create Plan"}</DialogTitle>
            <DialogDescription>Configure subscription plan details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="starter" />
            </div>
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Monthly Price (Rs)" type="number" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })} required />
              <Input label="Yearly Price (Rs)" type="number" value={form.yearlyPrice} onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="User Limit" type="number" value={form.userLimit} onChange={(e) => setForm({ ...form, userLimit: e.target.value })} required />
              <Input label="Storage (MB)" type="number" value={form.storageLimitMB} onChange={(e) => setForm({ ...form, storageLimitMB: e.target.value })} required />
            </div>
            <Input label="Sort Order" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            <div>
              <label className="mb-1.5 block text-sm font-medium">Features (one per line)</label>
              <textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })}
                className="flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Basic inventory&#10;Sales &amp; purchases&#10;Email support"
              />
            </div>
            {dialog.plan && (
              <div className="flex items-center gap-2">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                <label className="text-sm font-medium">Active</label>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog.plan ? "Update Plan" : "Create Plan"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
