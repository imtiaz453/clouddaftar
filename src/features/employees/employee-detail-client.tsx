"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  Briefcase,
  CalendarClock,
  BadgeCheck,
  Laptop,
  Shield,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/providers/toast-provider";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate, formatCurrency } from "@/lib/utils";

const ROLE_OPTIONS = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "STAFF", label: "Staff" },
  { value: "CASHIER", label: "Cashier" },
];

function initials(name: string | null) {
  return (
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??"
  );
}

export function EmployeeDetailClient({
  employee,
  branches,
}: {
  employee: any;
  branches: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [tab, setTab] = useState("work");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: employee.user?.name || "",
    phone: employee.user?.phone || "",
    email: employee.user?.email || "",
  });
  const [saving, setSaving] = useState(false);
  const [equipDialog, setEquipDialog] = useState(false);
  const [certDialog, setCertDialog] = useState(false);
  const [equipForm, setEquipForm] = useState({
    name: "",
    serialNumber: "",
    category: "",
    notes: "",
  });
  const [certForm, setCertForm] = useState({
    name: "",
    issuer: "",
    issueDate: "",
    expiryDate: "",
    referenceUrl: "",
  });

  const { equipment = [], certifications = [] } = employee;

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${employee.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed");
      addToast({ title: "Profile updated", variant: "success" });
      setEditOpen(false);
      router.refresh();
    } catch {
      addToast({ title: "Error", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(role: string) {
    try {
      const res = await fetch(`/api/employees/${employee.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, membershipId: employee.id }),
      });
      if (!res.ok) throw new Error("Failed");
      addToast({ title: "Role updated", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error", variant: "error" });
    }
  }

  async function handleBranchChange(branchId: string | null) {
    try {
      const res = await fetch(`/api/employees/${employee.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, membershipId: employee.id }),
      });
      if (!res.ok) throw new Error("Failed");
      addToast({ title: "Branch updated", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error", variant: "error" });
    }
  }

  async function handleAddEquipment(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/employees/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...equipForm, assignedToId: employee.userId }),
      });
      if (!res.ok) throw new Error("Failed");
      addToast({ title: "Equipment assigned", variant: "success" });
      setEquipDialog(false);
      setEquipForm({ name: "", serialNumber: "", category: "", notes: "" });
      router.refresh();
    } catch {
      addToast({ title: "Error", variant: "error" });
    }
  }

  async function handleReturnEquipment(id: string) {
    try {
      await fetch(`/api/employees/equipment?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: null }),
      });
      addToast({ title: "Equipment returned", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error", variant: "error" });
    }
  }

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteEmployee() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/employees/${employee.userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete employee");
      }
      addToast({ title: "Employee deleted", variant: "success" });
      router.push("/employees");
    } catch (err: any) {
      addToast({ title: err.message, variant: "error" });
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function handleAddCert(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/employees/certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...certForm, employeeId: employee.userId }),
      });
      if (!res.ok) throw new Error("Failed");
      addToast({ title: "Certification added", variant: "success" });
      setCertDialog(false);
      setCertForm({ name: "", issuer: "", issueDate: "", expiryDate: "", referenceUrl: "" });
      router.refresh();
    } catch {
      addToast({ title: "Error", variant: "error" });
    }
  }

  async function handleDeleteCert(id: string) {
    try {
      await fetch(`/api/employees/certifications?id=${id}`, { method: "DELETE" });
      addToast({ title: "Certification removed", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error", variant: "error" });
    }
  }

  const TABS = [
    { id: "work", label: "Work", icon: Briefcase },
    { id: "hr", label: "HR Settings", icon: Shield },
    { id: "equipment", label: "Equipment", icon: Laptop, count: equipment.length },
    {
      id: "certifications",
      label: "Certifications",
      icon: BadgeCheck,
      count: certifications.length,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} title="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarFallback>{initials(employee.user?.name)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-lg font-semibold">{employee.user?.name || "Unknown"}</h1>
          <p className="text-xs text-muted-foreground">
            {employee.user?.email} · {employee.role}
          </p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <Badge variant="secondary" className="ml-1 px-1 text-[10px]">
                {t.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {tab === "work" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Briefcase className="h-4 w-4" />
              Work Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Job Position</span>
                <span className="font-medium">{employee.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">{employee.branch?.name || "Unassigned"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Access Mode</span>
                <span className="font-medium">
                  {employee.permissionOverrides ? "Custom" : `Inherits ${employee.role}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined Date</span>
                <span className="font-medium">{formatDate(employee.joinedAt)}</span>
              </div>
            </div>
          </Card>
          <Card className="space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Phone className="h-4 w-4" />
              Contact
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{employee.user?.email || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{employee.user?.phone || "-"}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "hr" && (
        <Card className="space-y-4 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4" />
            HR Configuration
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
              <Select value={employee.role} onValueChange={handleRoleChange}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Department / Branch
              </label>
              <Select
                value={employee.branchId || "none"}
                onValueChange={(value) => handleBranchChange(value === "none" ? null : value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Company-wide / Unassigned</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {tab === "equipment" && (
        <Card className="overflow-auto p-0">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="text-sm font-semibold">Assigned Equipment ({equipment.length})</h3>
            <Button size="sm" variant="outline" onClick={() => setEquipDialog(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Assign
            </Button>
          </div>
          {equipment.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No equipment assigned</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="py-2 pl-2">Item</th>
                  <th className="py-2">Serial</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Assigned</th>
                  <th className="py-2 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((e: any) => (
                  <tr key={e.id} className="border-b border-border/30">
                    <td className="py-1.5 pl-2 font-medium">{e.name}</td>
                    <td className="py-1.5 text-xs text-muted-foreground">
                      {e.serialNumber || "-"}
                    </td>
                    <td className="py-1.5 text-xs">{e.category || "-"}</td>
                    <td className="py-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {e.status}
                      </Badge>
                    </td>
                    <td className="py-1.5 text-xs">
                      {e.assignedAt ? formatDate(e.assignedAt) : "-"}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleReturnEquipment(e.id)}
                        title="Return equipment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "certifications" && (
        <Card className="overflow-auto p-0">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="text-sm font-semibold">Certifications ({certifications.length})</h3>
            <Button size="sm" variant="outline" onClick={() => setCertDialog(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          {certifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No certifications</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="py-2 pl-2">Name</th>
                  <th className="py-2">Issuer</th>
                  <th className="py-2">Issue Date</th>
                  <th className="py-2">Expiry</th>
                  <th className="py-2 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {certifications.map((c: any) => (
                  <tr key={c.id} className="border-b border-border/30">
                    <td className="py-1.5 pl-2 font-medium">{c.name}</td>
                    <td className="py-1.5 text-xs">{c.issuer || "-"}</td>
                    <td className="py-1.5 text-xs">
                      {c.issueDate ? formatDate(c.issueDate) : "-"}
                    </td>
                    <td className="py-1.5 text-xs">
                      {c.expiryDate ? formatDate(c.expiryDate) : "-"}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDeleteCert(c.id)}
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <Input
              label="Name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
            <Input
              label="Phone"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={equipDialog} onOpenChange={setEquipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Equipment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddEquipment} className="space-y-4">
            <Input
              label="Equipment Name *"
              value={equipForm.name}
              onChange={(e) => setEquipForm({ ...equipForm, name: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Serial Number"
                value={equipForm.serialNumber}
                onChange={(e) => setEquipForm({ ...equipForm, serialNumber: e.target.value })}
              />
              <Input
                label="Category"
                value={equipForm.category}
                onChange={(e) => setEquipForm({ ...equipForm, category: e.target.value })}
              />
            </div>
            <Input
              label="Notes"
              value={equipForm.notes}
              onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEquipDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Assign</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={certDialog} onOpenChange={setCertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Certification</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCert} className="space-y-4">
            <Input
              label="Certification Name *"
              value={certForm.name}
              onChange={(e) => setCertForm({ ...certForm, name: e.target.value })}
              required
            />
            <Input
              label="Issuer"
              value={certForm.issuer}
              onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Issue Date"
                type="date"
                value={certForm.issueDate}
                onChange={(e) => setCertForm({ ...certForm, issueDate: e.target.value })}
              />
              <Input
                label="Expiry Date"
                type="date"
                value={certForm.expiryDate}
                onChange={(e) => setCertForm({ ...certForm, expiryDate: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCertDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Add</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => { if (!v) setDeleteOpen(false); }}
        title="Delete Employee"
        description={`Are you sure you want to delete ${employee.user?.name || "this employee"}? This will also revoke their system access. This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDeleteEmployee}
        loading={deleting}
      />
    </div>
  );
}
