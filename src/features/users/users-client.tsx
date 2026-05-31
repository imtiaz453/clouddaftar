"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  UserPlus,
  Mail,
  Clock,
  Eye,
  EyeOff,
  Trash2,
  Power,
  Key,
  MoreHorizontal,
  ShieldCheck,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/providers/toast-provider";
import {
  ROLE_LABELS,
  getCustomRoleLabel,
  getEffectiveRolePermissions,
  isCustomRoleKey,
  normalizeUserPermissionOverride,
  PERMISSIONS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Invitation } from "@prisma/client";
import { PermissionTreeEditor } from "./permission-tree-editor";
import { usePermissions } from "@/providers/permissions-provider";

interface UserWithRole {
  id: string;
  membershipId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  permissionOverrides?: unknown;
  branch?: { id: string; name: string } | null;
  assignedStores?: { id: string; name: string; type: string }[];
  assignedStockLocations?: { id: string; name: string; type: string }[];
  isActive: boolean;
  joinedAt: Date;
}

interface UsersClientProps {
  users: UserWithRole[];
  invitations: Invitation[];
  rolePermissions?: Record<string, string[]> | null;
  branches?: { id: string; name: string }[];
}

export function UsersClient({ users, invitations, rolePermissions, branches }: UsersClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const { data: session } = useSession();
  const permissions = usePermissions();
  const currentUserRole = (session?.user as any)?.role || "";
  const canManageUsers = permissions.includes(PERMISSIONS.USERS_MANAGE);
  const canManageRoles = permissions.includes(PERMISSIONS.ROLES_MANAGE);
  const canDisableUsers = permissions.includes(PERMISSIONS.USERS_DISABLE);
  const canResetPasswords = permissions.includes(PERMISSIONS.USERS_RESET_PASSWORD);
  const canOpenUserActions =
    canManageUsers || canManageRoles || canDisableUsers || canResetPasswords;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "STAFF",
    branchId: "",
    createStore: false,
  });
  const [loading, setLoading] = useState(false);

  const [resetDialog, setResetDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
  }>({ open: false, userId: "", userName: "" });
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean;
    membershipId: string;
    userName: string;
  }>({ open: false, membershipId: "", userName: "" });
  const [removing, setRemoving] = useState(false);
  const [permissionDialog, setPermissionDialog] = useState<{
    open: boolean;
    member: UserWithRole | null;
  }>({ open: false, member: null });
  const [permissionMode, setPermissionMode] = useState<"role" | "custom">("role");
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const customPermissionGroups = useMemo(
    () =>
      Object.entries(rolePermissions ?? {})
        .filter(([key]) => isCustomRoleKey(key))
        .sort(([a], [b]) => a.localeCompare(b)),
    [rolePermissions],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      // Reset after successful creation
      if (res.ok) setForm((prev) => ({ ...prev, createStore: false }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      addToast({
        title: "User created",
        description: `${form.name} can now log in`,
        variant: "success",
      });
      setDialogOpen(false);
      setForm({
        name: "",
        email: "",
        password: "",
        role: "STAFF",
        branchId: "",
        createStore: false,
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

  async function handleRoleChange(membershipId: string, role: string) {
    try {
      const res = await fetch("/api/users/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, role }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      addToast({ title: "Role updated", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error updating role", variant: "error" });
    }
  }

  async function handleToggleActive(userId: string, currentActive: boolean) {
    try {
      const res = await fetch("/api/users/toggle-active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isActive: !currentActive }),
      });
      if (!res.ok) throw new Error("Failed to update user");
      addToast({
        title: currentActive ? "User deactivated" : "User activated",
        variant: "success",
      });
      router.refresh();
    } catch {
      addToast({ title: "Error updating user", variant: "error" });
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (resetPassword.length < 8) {
      addToast({ title: "Password must be at least 8 characters", variant: "error" });
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/users/reset-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetDialog.userId, newPassword: resetPassword }),
      });
      if (!res.ok) throw new Error("Failed to reset password");
      addToast({ title: "Password reset successful", variant: "success" });
      setResetDialog({ open: false, userId: "", userName: "" });
      setResetPassword("");
      router.refresh();
    } catch {
      addToast({ title: "Error resetting password", variant: "error" });
    } finally {
      setResetting(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch("/api/users/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: removeDialog.membershipId }),
      });
      if (!res.ok) throw new Error("Failed to remove user");
      addToast({ title: "Member removed", variant: "success" });
      setRemoveDialog({ open: false, membershipId: "", userName: "" });
      router.refresh();
    } catch {
      addToast({ title: "Error removing user", variant: "error" });
    } finally {
      setRemoving(false);
    }
  }

  function openPermissions(member: UserWithRole) {
    const override = normalizeUserPermissionOverride(member.permissionOverrides);
    const inherited = getEffectiveRolePermissions(member.role, rolePermissions);
    setPermissionMode(override.mode === "custom" ? "custom" : "role");
    setPermissionDraft(override.mode === "custom" ? (override.permissions ?? []) : inherited);
    setPermissionDialog({ open: true, member });
  }

  async function handleSavePermissions() {
    const member = permissionDialog.member;
    if (!member) return;
    setSavingPermissions(true);
    try {
      const res = await fetch("/api/users/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: member.membershipId,
          permissionOverrides: {
            mode: permissionMode,
            permissions: permissionMode === "custom" ? permissionDraft : [],
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to update permissions");
      addToast({ title: "User permissions updated", variant: "success" });
      setPermissionDialog({ open: false, member: null });
      router.refresh();
    } catch (error) {
      addToast({
        title: "Error updating permissions",
        description: error instanceof Error ? error.message : "Failed",
        variant: "error",
      });
    } finally {
      setSavingPermissions(false);
    }
  }

  const initials = (name: string | null) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";
  const permissionMember = permissionDialog.member;
  const inheritedPermissions = permissionMember
    ? getEffectiveRolePermissions(permissionMember.role, rolePermissions)
    : [];

  return (
    <div>
      <PageHeader title="Team" description="Manage your team members and roles">
        {canManageUsers && (
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Team Members ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {users.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{member.name || "Unknown"}</p>
                        {normalizeUserPermissionOverride(member.permissionOverrides).mode ===
                          "custom" && (
                          <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                            Custom access
                          </Badge>
                        )}
                        {!member.isActive && (
                          <Badge variant="destructive" className="px-1 py-0 text-[10px]">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          {member.branch?.name || "All / no branch"}
                        </Badge>
                        {(member.assignedStores || []).map((store) => (
                          <Badge
                            key={store.id}
                            variant="secondary"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            Store: {store.name}
                          </Badge>
                        ))}
                        {(member.assignedStockLocations || [])
                          .filter(
                            (location) =>
                              !(member.assignedStores || []).some(
                                (store) => store.name === location.name,
                              ),
                          )
                          .map((location) => (
                            <Badge
                              key={location.id}
                              variant="secondary"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              Stock: {location.name}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageRoles ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleRoleChange(member.membershipId, v)}
                      >
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="MANAGER">Manager</SelectItem>
                          <SelectItem value="STAFF">Staff</SelectItem>
                          <SelectItem value="CASHIER">Cashier</SelectItem>
                          {currentUserRole === "OWNER" && (
                            <SelectItem value="OWNER">Owner</SelectItem>
                          )}
                          {customPermissionGroups.length > 0 && (
                            <>
                              <div className="mt-1 border-t px-2 py-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Custom Roles
                              </div>
                              {customPermissionGroups.map(([key]) => (
                                <SelectItem key={key} value={key}>
                                  {getCustomRoleLabel(key)}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge>
                        {normalizeUserPermissionOverride(member.permissionOverrides).mode ===
                        "custom"
                          ? "Custom Access"
                          : ROLE_LABELS[member.role] || member.role}
                      </Badge>
                    )}
                    {canOpenUserActions && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="User actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {canDisableUsers && (
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(member.id, member.isActive)}
                            >
                              <Power className="mr-2 h-4 w-4" />
                              {member.isActive ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                          )}
                          {canResetPasswords && (
                            <DropdownMenuItem
                              onClick={() => {
                                setResetDialog({
                                  open: true,
                                  userId: member.id,
                                  userName: member.name || member.email,
                                });
                                setResetPassword("");
                              }}
                            >
                              <Key className="mr-2 h-4 w-4" />
                              Reset Password
                            </DropdownMenuItem>
                          )}
                          {canManageRoles && (
                            <DropdownMenuItem onClick={() => openPermissions(member)}>
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              Permissions
                            </DropdownMenuItem>
                          )}
                          {canManageUsers && <DropdownMenuSeparator />}
                          {canManageUsers && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() =>
                                setRemoveDialog({
                                  open: true,
                                  membershipId: member.membershipId,
                                  userName: member.name || member.email,
                                })
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending invitations</p>
              ) : (
                invitations.map((inv) => (
                  <div key={inv.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{inv.email}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(inv.expiresAt)}
                    </div>
                    <Badge className="mt-2" variant="secondary">
                      {ROLE_LABELS[inv.role] || inv.role}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team Member</DialogTitle>
            <DialogDescription>Add a new user to your company</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="Full Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="John Ahmed"
            />
            <Input
              label="Email Address"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="colleague@example.com"
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                placeholder="Min 8 characters"
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Role</label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                  {currentUserRole === "OWNER" && <SelectItem value="OWNER">Owner</SelectItem>}
                  {customPermissionGroups.length > 0 && (
                    <>
                      <div className="mt-1 border-t px-2 py-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Custom Roles
                      </div>
                      {customPermissionGroups.map(([key]) => (
                        <SelectItem key={key} value={key}>
                          {getCustomRoleLabel(key)}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {branches && branches.length > 0 && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Branch</label>
                <Select
                  value={form.branchId || "none"}
                  onValueChange={(v) => setForm({ ...form, branchId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No branch" />
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
            {form.role === "STAFF" && (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={form.createStore}
                  onChange={(e) => setForm({ ...form, createStore: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span>Create employee store for this user</span>
              </label>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create User"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetDialog.open}
        onOpenChange={(open) => setResetDialog({ ...resetDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for {resetDialog.userName}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min 8 characters"
            />
            <Button type="submit" className="w-full" disabled={resetting}>
              {resetting ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={permissionDialog.open}
        onOpenChange={(open) =>
          setPermissionDialog({ open, member: open ? permissionDialog.member : null })
        }
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Permissions</DialogTitle>
            <DialogDescription>
              {permissionMember
                ? `Set access for ${permissionMember.name || permissionMember.email}`
                : "Set user access"}
            </DialogDescription>
          </DialogHeader>

          {permissionMember && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Role group</p>
                  <p className="text-sm font-medium">
                    {ROLE_LABELS[permissionMember.role] || permissionMember.role}
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Permission mode</label>
                  <Select
                    value={permissionMode}
                    onValueChange={(value) => {
                      const mode = value as "role" | "custom";
                      setPermissionMode(mode);
                      if (mode === "role") setPermissionDraft(inheritedPermissions);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="role">Inherit role permissions</SelectItem>
                      <SelectItem value="custom">Custom permissions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {customPermissionGroups.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Apply permission group</label>
                  <Select
                    value="none"
                    onValueChange={(value) => {
                      if (value === "none") return;
                      setPermissionMode("custom");
                      setPermissionDraft(rolePermissions?.[value] ?? []);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a saved group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose a saved group</SelectItem>
                      {customPermissionGroups.map(([key, permissions]) => (
                        <SelectItem key={key} value={key}>
                          {getCustomRoleLabel(key)} ({permissions.length})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <PermissionTreeEditor
                value={permissionMode === "custom" ? permissionDraft : inheritedPermissions}
                disabled={permissionMode === "role"}
                onChange={setPermissionDraft}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPermissionDialog({ open: false, member: null })}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleSavePermissions} disabled={savingPermissions}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingPermissions ? "Saving..." : "Save Permissions"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeDialog.open}
        onOpenChange={(open) => setRemoveDialog({ ...removeDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {removeDialog.userName}? They will lose access to this
              company.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRemoveDialog({ open: false, membershipId: "", userName: "" })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? "Removing..." : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
