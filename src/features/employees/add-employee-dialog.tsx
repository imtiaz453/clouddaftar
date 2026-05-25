"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Eye, EyeOff, MonitorCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/providers/toast-provider";

interface AddEmployeeDialogProps {
  branches?: { id: string; name: string }[];
}

export function AddEmployeeDialog({ branches }: AddEmployeeDialogProps) {
  const router = useRouter();
  const { addToast } = useToast();

  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    hasSystemAccess: false,
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "STAFF",
    branchId: "",
    jobTitle: "",
    department: "",
    employmentType: "FULL_TIME",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(form.hasSystemAccess ? "/api/users/create" : "/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          password: form.hasSystemAccess ? form.password : undefined,
          role: form.hasSystemAccess ? form.role : undefined,
          branchId: form.branchId || undefined,
          jobTitle: form.jobTitle || undefined,
          department: form.department || undefined,
          employmentType: form.employmentType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create employee");
      addToast({
        title: "Employee created",
        description: `${form.name} has been added`,
        variant: "success",
      });
      setOpen(false);
      setForm({
        hasSystemAccess: false,
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "STAFF",
        branchId: "",
        jobTitle: "",
        department: "",
        employmentType: "FULL_TIME",
      });
      router.refresh();
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        Add Employee
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader>
            <div className="rounded-t-xl bg-zinc-950 px-6 py-5 text-white">
              <DialogTitle className="text-white">Add Employee</DialogTitle>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Create an HR-only employee record, or add a system user with login access.
              </p>
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-0 lg:grid-cols-[18rem_1fr]">
            <div className="border-b bg-zinc-50 p-4 lg:border-b-0 lg:border-r">
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, hasSystemAccess: false })}
                  className={`rounded-xl border p-4 text-left transition ${
                    !form.hasSystemAccess
                      ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                      : "bg-white hover:border-cyan-500"
                  }`}
                >
                  <BriefcaseBusiness className="h-5 w-5" />
                  <span className="mt-3 block text-base font-extrabold">HR Record</span>
                  <span
                    className={`mt-1 block text-xs leading-5 ${
                      !form.hasSystemAccess ? "text-zinc-300" : "text-muted-foreground"
                    }`}
                  >
                    Drivers, cleaners, temporary workers, and offline staff.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, hasSystemAccess: true })}
                  className={`rounded-xl border p-4 text-left transition ${
                    form.hasSystemAccess
                      ? "border-cyan-700 bg-cyan-700 text-white shadow-sm"
                      : "bg-white hover:border-cyan-500"
                  }`}
                >
                  <MonitorCheck className="h-5 w-5" />
                  <span className="mt-3 block text-base font-extrabold">System User</span>
                  <span
                    className={`mt-1 block text-xs leading-5 ${
                      form.hasSystemAccess ? "text-cyan-50" : "text-muted-foreground"
                    }`}
                  >
                    Staff who need login, role permissions, and app access.
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full Name *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  label={form.hasSystemAccess ? "Email *" : "Email"}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required={form.hasSystemAccess}
                />
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Work or personal phone"
                />
                {!form.hasSystemAccess && (
                  <Input
                    label="Job Title"
                    value={form.jobTitle}
                    onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                    placeholder="Driver"
                  />
                )}
              </div>

              {form.hasSystemAccess && (
                <div className="relative">
                  <Input
                    label="Password *"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-8 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}

              {!form.hasSystemAccess && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Department"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="Operations"
                  />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Employment Type</label>
                    <Select
                      value={form.employmentType}
                      onValueChange={(v) => setForm({ ...form, employmentType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FULL_TIME">Full time</SelectItem>
                        <SelectItem value="PART_TIME">Part time</SelectItem>
                        <SelectItem value="CONTRACT">Contract</SelectItem>
                        <SelectItem value="TEMPORARY">Temporary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {form.hasSystemAccess && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Role</label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STAFF">Staff</SelectItem>
                        <SelectItem value="CASHIER">Cashier</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="OWNER">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {branches && branches.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Branch</label>
                    <Select
                      value={form.branchId || "none"}
                      onValueChange={(v) => setForm({ ...form, branchId: v === "none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No branch</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Employee"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
