"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/providers/toast-provider";
import { cn } from "@/lib/utils";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  getEffectiveRolePermissions,
  getCustomRoleLabel,
  isCustomRoleKey,
  makeCustomRoleKey,
  normalizeRolePermissionOverrides,
  type RolePermissionMap,
} from "@/lib/constants";
import { KeyRound, Lock, Plus, RotateCcw, Save, Shield, Trash2 } from "lucide-react";
import { PermissionTreeEditor } from "../permission-tree-editor";

interface RolesClientProps {
  rolePermissions?: unknown;
}

const baseRoles = Object.values(ROLES);

function samePermissions(a: string[], b: string[]) {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildInitialPermissions(rolePermissions: unknown): RolePermissionMap {
  const overrides = normalizeRolePermissionOverrides(rolePermissions);
  return baseRoles.reduce<RolePermissionMap>(
    (acc, role) => {
      acc[role] =
        role === ROLES.OWNER
          ? ROLE_PERMISSIONS.OWNER
          : (overrides[role] ?? ROLE_PERMISSIONS[role] ?? []);
      return acc;
    },
    { ...overrides },
  );
}

export function RolesClient({ rolePermissions }: RolesClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>(ROLES.MANAGER);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<RolePermissionMap>(() =>
    buildInitialPermissions(rolePermissions),
  );
  const [newGroupName, setNewGroupName] = useState("");

  const selectedPermissions = draft[selectedRole] ?? [];
  const isOwner = selectedRole === ROLES.OWNER;
  const isCustomGroup = isCustomRoleKey(selectedRole);
  const selectedLabel = isCustomGroup
    ? getCustomRoleLabel(selectedRole)
    : (ROLE_LABELS[selectedRole] ?? selectedRole);
  const totalPermissions = ROLE_PERMISSIONS.OWNER.length;
  const coverage = Math.round((selectedPermissions.length / totalPermissions) * 100);

  const customRoles = useMemo(
    () =>
      Object.keys(draft)
        .filter(isCustomRoleKey)
        .sort((a, b) => a.localeCompare(b)),
    [draft],
  );
  const editableRoles = useMemo(() => [...baseRoles, ...customRoles], [customRoles]);

  const customizedRoles = useMemo(() => {
    const customized = new Set<string>();
    for (const role of baseRoles) {
      if (role === ROLES.OWNER) continue;
      if (!samePermissions(draft[role] ?? [], ROLE_PERMISSIONS[role] ?? [])) {
        customized.add(role);
      }
    }
    return customized;
  }, [draft]);

  function setPermissions(role: string, permissions: string[]) {
    if (role === ROLES.OWNER) return;
    setDraft((prev) => ({ ...prev, [role]: permissions }));
  }

  function resetRole(role: string) {
    if (role === ROLES.OWNER) return;
    setDraft((prev) => ({
      ...prev,
      [role]: isCustomRoleKey(role) ? [] : (ROLE_PERMISSIONS[role] ?? []),
    }));
  }

  function addCustomGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    let key = makeCustomRoleKey(name);
    let suffix = 2;
    while (draft[key]) {
      key = makeCustomRoleKey(`${name} ${suffix}`);
      suffix += 1;
    }
    setDraft((prev) => ({ ...prev, [key]: ROLE_PERMISSIONS.STAFF ?? [] }));
    setSelectedRole(key);
    setNewGroupName("");
  }

  function deleteCustomGroup(role: string) {
    if (!isCustomRoleKey(role)) return;
    setDraft((prev) => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
    if (selectedRole === role) setSelectedRole(ROLES.MANAGER);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _type: "permissions", rolePermissions: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save permissions");
      }
      addToast({ title: "Permissions saved", variant: "success" });
      router.refresh();
    } catch (error) {
      addToast({
        title: "Error saving permissions",
        description: error instanceof Error ? error.message : "Failed",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <Card className="overflow-hidden border-zinc-200 bg-zinc-950 p-0 text-white shadow-sm">
          <div className="border-b border-white/10 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-500">
              <KeyRound className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-lg font-extrabold">Access presets</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-300">
              Pick a role, tune its permissions, and save the preset for future team members.
            </p>
          </div>
          <div className="space-y-3 bg-white p-3 text-zinc-950">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Sales supervisor"
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustomGroup();
              }}
            />
            <Button type="button" className="w-full" onClick={addCustomGroup}>
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </div>
        </Card>

        <Card className="space-y-2 p-2">
          <div>
            <p className="px-2 py-1 text-xs font-bold uppercase text-muted-foreground">Roles</p>
          </div>
          {editableRoles.map((role) => {
            const permissions = getEffectiveRolePermissions(role, draft);
            const selected = selectedRole === role;
            const customGroup = isCustomRoleKey(role);
            const roleLabel = customGroup ? getCustomRoleLabel(role) : ROLE_LABELS[role];
            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors",
                  selected && "border-zinc-950 bg-zinc-950 text-white shadow-sm",
                )}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                    selected ? "bg-white text-zinc-950" : "bg-primary/10 text-primary",
                  )}
                >
                  {role === ROLES.OWNER ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{roleLabel}</p>
                    {customGroup && (
                      <Badge variant={selected ? "secondary" : "outline"} className="text-[10px]">
                        Group
                      </Badge>
                    )}
                    {customizedRoles.has(role) && (
                      <Badge variant="secondary" className="text-[10px]">
                        Custom
                      </Badge>
                    )}
                  </div>
                  <p
                    className={cn("text-xs", selected ? "text-zinc-300" : "text-muted-foreground")}
                  >
                    {permissions.length} permission{permissions.length === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
            );
          })}
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b bg-white p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-extrabold">{selectedLabel}</h2>
                {isOwner && <Badge>Always full access</Badge>}
                {isCustomGroup && <Badge variant="outline">Custom group</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Navigation, tabs, forms, and server-side actions follow this access map.
              </p>
            </div>
            <div className="grid min-w-64 grid-cols-2 gap-2">
              <div className="rounded-lg border bg-zinc-50 p-3">
                <p className="text-2xl font-black">{coverage}%</p>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Coverage</p>
              </div>
              <div className="rounded-lg border bg-zinc-50 p-3">
                <p className="text-2xl font-black">{selectedPermissions.length}</p>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Allowed</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold">Permission matrix</p>
            <p className="text-xs text-muted-foreground">Module parent, tab child, action leaf.</p>
          </div>
          <div className="flex gap-2">
            {!isOwner && (
              <Button type="button" variant="outline" onClick={() => resetRole(selectedRole)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {isCustomGroup ? "Clear Group" : "Reset Role"}
              </Button>
            )}
            {isCustomGroup && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteCustomGroup(selectedRole)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Group
              </Button>
            )}
            <Button type="button" onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Permissions"}
            </Button>
          </div>
        </div>

        <div className="p-5">
          <PermissionTreeEditor
            value={selectedPermissions}
            disabled={isOwner}
            onChange={(permissions) => setPermissions(selectedRole, permissions)}
          />
        </div>
      </Card>
    </div>
  );
}
