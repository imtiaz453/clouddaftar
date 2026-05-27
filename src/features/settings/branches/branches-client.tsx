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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Plus, Pencil, Power, PowerOff, Trash2 } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  isDefault: boolean;
  isActive: boolean;
  warehouses?: { id: string }[];
}

interface BranchesClientProps {
  branches: Branch[];
}

export function BranchesClient({ branches }: BranchesClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", phone: "", email: "", address: "", city: "" });

  function resetForm() {
    setForm({ name: "", code: "", phone: "", email: "", address: "", city: "" });
    setEditBranch(null);
  }

  function openEdit(branch: Branch) {
    setEditBranch(branch);
    setForm({
      name: branch.name,
      code: branch.code,
      phone: branch.phone || "",
      email: branch.email || "",
      address: branch.address || "",
      city: branch.city || "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast({ title: "Branch name is required", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const action = editBranch ? "/api/settings/branches" : "/api/settings/branches";
      const method = editBranch ? "PUT" : "POST";
      const res = await fetch(action, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editBranch ? { ...form, id: editBranch.id } : form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save branch");
      }
      addToast({ title: editBranch ? "Branch updated" : "Branch created", variant: "success" });
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err: any) {
      addToast({ title: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(branch: Branch) {
    try {
      const res = await fetch("/api/settings/branches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: branch.id, isActive: !branch.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update branch");
      addToast({ title: branch.isActive ? "Branch disabled" : "Branch enabled", variant: "success" });
      router.refresh();
    } catch (err: any) {
      addToast({ title: err.message, variant: "error" });
    }
  }

  const [deleteBranch, setDeleteBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteBranch) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/settings/branches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteBranch.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete branch");
      }
      addToast({ title: "Branch deleted", variant: "success" });
      setDeleteBranch(null);
      router.refresh();
    } catch (err: any) {
      addToast({ title: err.message, variant: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Manage business locations, showrooms, and POS outlets"
      >
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> New Branch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editBranch ? "Edit Branch" : "Create Branch"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Name *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Branch" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Code</label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BRANCH-01" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92 300 1234567" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="branch@company.com" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">City</label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Karachi" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Address</label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : editBranch ? "Update" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-center">Stores</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No branches yet. Create your first branch.
                  </TableCell>
                </TableRow>
              ) : (
                branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell className="text-muted-foreground">{branch.code}</TableCell>
                    <TableCell className="text-muted-foreground">{branch.city || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{branch.phone || "-"}</TableCell>
                    <TableCell className="text-center">{branch.warehouses?.length ?? 0}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={branch.isActive ? "default" : "secondary"}>
                        {branch.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(branch)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleToggleActive(branch)} title={branch.isActive ? "Disable" : "Enable"}>
                          {branch.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteBranch(branch)} title="Delete">
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
        open={!!deleteBranch}
        onOpenChange={(v) => { if (!v) setDeleteBranch(null); }}
        title="Delete Branch"
        description={`Are you sure you want to delete "${deleteBranch?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
