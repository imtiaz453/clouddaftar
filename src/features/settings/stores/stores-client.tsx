"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Plus, Pencil, Power, PowerOff, Trash2, Warehouse, Store, User } from "lucide-react";

const STORE_TYPES = [
  { value: "MAIN_WAREHOUSE", label: "Main Warehouse" },
  { value: "POS_STORE", label: "POS / Showroom Store" },
  { value: "EMPLOYEE_STORE", label: "Employee Store" },
] as const;

const STORE_TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  MAIN_WAREHOUSE: "default",
  POS_STORE: "secondary",
  EMPLOYEE_STORE: "outline",
};

interface Store {
  id: string;
  name: string;
  code: string;
  type: string;
  branchId: string | null;
  assignedEmployeeId: string | null;
  isDefault: boolean;
  isActive: boolean;
  notes: string | null;
  branch: { id: string; name: string; code: string } | null;
  assignedEmployee: { id: string; name: string; email: string } | null;
}

interface StoresClientProps {
  stores: Store[];
  branches: { id: string; name: string; code: string }[];
  employees: { id: string; name: string; email: string }[];
}

export function StoresClient({ stores, branches, employees }: StoresClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "MAIN_WAREHOUSE",
    branchId: "",
    assignedEmployeeId: "",
    isDefault: false,
    notes: "",
  });

  function resetForm() {
    setForm({ name: "", code: "", type: "MAIN_WAREHOUSE", branchId: "", assignedEmployeeId: "", isDefault: false, notes: "" });
    setEditStore(null);
  }

  function openEdit(store: Store) {
    setEditStore(store);
    setForm({
      name: store.name,
      code: store.code,
      type: store.type,
      branchId: store.branchId || "",
      assignedEmployeeId: store.assignedEmployeeId || "",
      isDefault: store.isDefault,
      notes: store.notes || "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { addToast({ title: "Store name is required", variant: "error" }); return; }
    if (!form.code.trim()) { addToast({ title: "Store code is required", variant: "error" }); return; }
    if (form.type === "POS_STORE" && !form.branchId) { addToast({ title: "Branch is required for POS/Showroom stores", variant: "error" }); return; }
    if (form.type === "EMPLOYEE_STORE" && !form.assignedEmployeeId) { addToast({ title: "Employee is required for Employee stores", variant: "error" }); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/stores", {
        method: editStore ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editStore ? { ...form, id: editStore.id } : form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save store");
      }
      addToast({ title: editStore ? "Store updated" : "Store created", variant: "success" });
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err: any) {
      addToast({ title: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(store: Store) {
    try {
      const res = await fetch("/api/settings/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: store.id, isActive: !store.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update store");
      addToast({ title: store.isActive ? "Store disabled" : "Store enabled", variant: "success" });
      router.refresh();
    } catch (err: any) {
      addToast({ title: err.message, variant: "error" });
    }
  }

  const [deleteStore, setDeleteStore] = useState<Store | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteStore) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/settings/stores", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteStore.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete store");
      }
      addToast({ title: "Store deleted", variant: "success" });
      setDeleteStore(null);
      router.refresh();
    } catch (err: any) {
      addToast({ title: err.message, variant: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const filteredStores = stores.filter((s) => {
    if (filterType !== "all" && s.type !== filterType) return false;
    if (filterStatus === "active" && !s.isActive) return false;
    if (filterStatus === "inactive" && s.isActive) return false;
    return true;
  });

  const typeIcon = (type: string) => {
    switch (type) {
      case "MAIN_WAREHOUSE": return <Warehouse className="h-4 w-4" />;
      case "POS_STORE": return <Store className="h-4 w-4" />;
      case "EMPLOYEE_STORE": return <User className="h-4 w-4" />;
      default: return <Store className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stores"
        description="Manage inventory locations, warehouses, and employee stores"
      >
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> New Store
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editStore ? "Edit Store" : "Create Store"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Store Name *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Warehouse" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Store Code *</label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WH-01" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Store Type *</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STORE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.type === "POS_STORE" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Linked Branch *</label>
                  <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(form.type === "EMPLOYEE_STORE" || form.type === "MAIN_WAREHOUSE") && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Assigned Employee{form.type === "EMPLOYEE_STORE" ? " *" : " (optional)"}
                  </label>
                  <Select value={form.assignedEmployeeId} onValueChange={(v) => setForm({ ...form, assignedEmployeeId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={form.type === "EMPLOYEE_STORE" ? "Select employee" : "Select employee (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes</label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="isDefault" className="text-sm">Set as default store</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : editStore ? "Update" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {STORE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-center">Default</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No stores found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell className="text-muted-foreground">{store.code}</TableCell>
                    <TableCell>
                      <Badge variant={STORE_TYPE_VARIANTS[store.type] || "secondary"} className="gap-1">
                        {typeIcon(store.type)}
                        {STORE_TYPES.find((t) => t.value === store.type)?.label || store.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{store.branch?.name || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{store.assignedEmployee?.name || "-"}</TableCell>
                    <TableCell className="text-center">
                      {store.isDefault ? <Badge variant="outline">Default</Badge> : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={store.isActive ? "default" : "secondary"}>
                        {store.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(store)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleToggleActive(store)} title={store.isActive ? "Disable" : "Enable"}>
                          {store.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteStore(store)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteStore}
        onOpenChange={(v) => { if (!v) setDeleteStore(null); }}
        title="Delete Store"
        description={`Are you sure you want to delete "${deleteStore?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
