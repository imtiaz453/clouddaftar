"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, Layers3, Minus, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PERMISSION_GROUPS, PERMISSION_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PermissionTreeEditorProps {
  value: string[];
  disabled?: boolean;
  onChange: (permissions: string[]) => void;
}

function permissionKind(permission: string) {
  const label = (PERMISSION_LABELS[permission] || permission).toLowerCase();
  if (label.includes("view") || label.includes("read") || label.includes("report")) return "Read";
  if (label.includes("create") || label.includes("edit") || label.includes("manage"))
    return "Write";
  if (label.includes("delete") || label.includes("remove")) return "Delete";
  return "Action";
}

function toggleList(current: string[], permissions: string[], checked: boolean) {
  const next = new Set(current);
  for (const permission of permissions) {
    if (checked) next.add(permission);
    else next.delete(permission);
  }
  return Array.from(next);
}

export function PermissionTreeEditor({ value, disabled, onChange }: PermissionTreeEditorProps) {
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const allPermissions = PERMISSION_GROUPS.flatMap((group) => group.permissions);
  const selectedCount = allPermissions.filter((permission) => selected.has(permission)).length;
  const allSelected = selectedCount === allPermissions.length;
  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PERMISSION_GROUPS;
    return PERMISSION_GROUPS.map((group) => ({
      ...group,
      permissions: group.permissions.filter((permission) => {
        const label = PERMISSION_LABELS[permission] || permission;
        return (
          group.label.toLowerCase().includes(q) ||
          label.toLowerCase().includes(q) ||
          permission.toLowerCase().includes(q) ||
          permissionKind(permission).toLowerCase().includes(q)
        );
      }),
    })).filter((group) => group.permissions.length > 0);
  }, [query]);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-zinc-950 p-4 text-white shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-white">
              <Layers3 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-extrabold">Access hierarchy</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-300">
                Module selection cascades to every child tab and action. Fine tune access by
                removing individual read, write, delete, or workflow permissions.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-80">
            <div className="rounded-lg border border-white/10 bg-white/10 p-3">
              <p className="text-2xl font-black">{selectedCount}</p>
              <p className="text-xs font-semibold uppercase text-zinc-300">Enabled</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 p-3">
              <p className="text-2xl font-black">{allPermissions.length}</p>
              <p className="text-xs font-semibold uppercase text-zinc-300">Available</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules, tabs, read, write, delete..."
              className="h-11 w-full rounded-lg border border-white/10 bg-white px-9 text-sm font-medium text-zinc-950 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          {!disabled && (
            <Button
              type="button"
              className="h-11 bg-white text-zinc-950 hover:bg-zinc-100"
              onClick={() => onChange(allSelected ? [] : allPermissions)}
            >
              {allSelected ? "Clear all" : "Select all"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleGroups.map((group) => {
          const checkedCount = group.permissions.filter((permission) =>
            selected.has(permission),
          ).length;
          const groupChecked = checkedCount === group.permissions.length;
          const groupPartial = checkedCount > 0 && !groupChecked;

          return (
            <div key={group.label} className="overflow-hidden rounded-lg border bg-card shadow-sm">
              <label
                className={cn(
                  "flex items-center gap-3 border-b bg-zinc-50 px-4 py-4 dark:bg-zinc-900",
                  disabled
                    ? "cursor-not-allowed opacity-75"
                    : "cursor-pointer hover:bg-cyan-50 dark:hover:bg-zinc-800",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg border",
                    groupChecked || groupPartial
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background",
                  )}
                >
                  {groupChecked ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : groupPartial ? (
                    <Minus className="h-3.5 w-3.5" />
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  checked={groupChecked}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(toggleList(value, group.permissions, event.target.checked))
                  }
                  className="sr-only"
                />
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>
                    <span className="block text-base font-extrabold">{group.label}</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      Module, tabs, and actions
                    </span>
                  </span>
                </span>
                <Badge variant={groupPartial ? "secondary" : "outline"} className="text-xs">
                  {checkedCount}/{group.permissions.length}
                </Badge>
              </label>

              <div className="space-y-2 p-3">
                {group.permissions.map((permission) => {
                  const checked = selected.has(permission);
                  return (
                    <label
                      key={permission}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                        checked ? "border-primary/50 bg-primary/5 shadow-sm" : "border-border",
                        disabled
                          ? "cursor-not-allowed opacity-70"
                          : "cursor-pointer hover:bg-muted/50",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) =>
                          onChange(toggleList(value, [permission], event.target.checked))
                        }
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {PERMISSION_LABELS[permission] || permission}
                        </span>
                        <span className="text-xs text-muted-foreground">{permission}</span>
                      </span>
                      {checked && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      <Badge variant="outline" className="text-[10px]">
                        {permissionKind(permission)}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
