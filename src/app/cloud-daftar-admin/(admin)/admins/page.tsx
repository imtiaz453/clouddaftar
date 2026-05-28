"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Shield, ShieldAlert, ShieldCheck, UserCog } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface Admin {
  id: string; name: string; email: string; role: string;
  isActive: boolean; lastLoginAt: string | null; createdAt: string;
}

const roleIcons: Record<string, any> = {
  OWNER: ShieldAlert,
  SUPER_ADMIN: ShieldCheck,
  BILLING_ADMIN: Shield,
  SUPPORT_ADMIN: Shield,
};

const roleColors: Record<string, "default" | "secondary" | "destructive" | "success" | "warning"> = {
  OWNER: "destructive",
  SUPER_ADMIN: "success",
  BILLING_ADMIN: "default",
  SUPPORT_ADMIN: "secondary",
};

export default function AdminAdminsPage() {
  const { addToast } = useToast();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; admin?: Admin; mode: "create" | "edit" }>({ open: false, mode: "create" });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SUPER_ADMIN" });

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/admins");
      const d = await res.json();
      if (d.success) setAdmins(d.data.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  function openCreate() {
    setForm({ name: "", email: "", password: "", role: "SUPER_ADMIN" });
    setDialog({ open: true, mode: "create" });
  }

  function openEdit(admin: Admin) {
    setForm({ name: admin.name, email: admin.email, password: "", role: admin.role });
    setDialog({ open: true, admin, mode: "edit" });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (dialog.mode === "create") {
        const res = await fetch("/api/admin/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const d = await res.json();
        if (d.success) {
          addToast({ title: "Admin created", variant: "success" });
          setDialog({ open: false, mode: "create" });
          fetchAdmins();
        } else throw new Error(d.error);
      } else if (dialog.admin) {
        const body: any = { id: dialog.admin.id, name: form.name, role: form.role };
        const res = await fetch("/api/admin/admins", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await res.json();
        if (d.success) {
          addToast({ title: "Admin updated", variant: "success" });
          setDialog({ open: false, mode: "edit" });
          fetchAdmins();
        } else throw new Error(d.error);
      }
    } catch (err) {
      addToast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally { setSaving(false); }
  }

  async function handleToggleActive(admin: Admin) {
    try {
      const res = await fetch("/api/admin/admins", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: admin.id, isActive: !admin.isActive }),
      });
      const d = await res.json();
      if (d.success) {
        addToast({ title: admin.isActive ? "Admin deactivated" : "Admin activated", variant: "success" });
        fetchAdmins();
      } else throw new Error(d.error);
    } catch (err) {
      addToast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "error" });
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><LoadingSpinner size={8} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Management</h1>
          <p className="text-muted-foreground">Manage system administrators and roles</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Admin</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No admins found</TableCell>
                </TableRow>
              ) : admins.map((admin) => {
                const RoleIcon = roleIcons[admin.role] || Shield;
                return (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {admin.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{admin.name}</p>
                          <p className="text-xs text-muted-foreground">{admin.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleColors[admin.role] || "secondary"} className="gap-1">
                        <RoleIcon className="h-3 w-3" />
                        {admin.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={admin.isActive ? "success" : "secondary"}>{admin.isActive ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(admin)}>
                          <UserCog className="h-4 w-4" />
                        </Button>
                        {admin.role !== "OWNER" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(admin)}
                          >
                            <Badge variant={admin.isActive ? "secondary" : "success"} className="text-xs px-1">
                              {admin.isActive ? "Deactivate" : "Activate"}
                            </Badge>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ ...dialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.mode === "create" ? "Add Admin" : "Edit Admin"}</DialogTitle>
            <DialogDescription>
              {dialog.mode === "create" ? "Create a new system administrator" : "Update admin details and role"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={dialog.mode === "edit"} />
            {dialog.mode === "create" && (
              <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Role</label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="BILLING_ADMIN">Billing Admin</SelectItem>
                  <SelectItem value="SUPPORT_ADMIN">Support Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <LoadingSpinner size={4} className="mr-2" />}
              {dialog.mode === "create" ? "Create Admin" : "Update Admin"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
