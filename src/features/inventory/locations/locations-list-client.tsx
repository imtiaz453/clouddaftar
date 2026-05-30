"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Package, Search, Plus, X, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { LocationCreateDialog } from "./location-create-dialog";

const LOCATION_TYPES = [
  { value: "all", label: "All Types" },
  { value: "MAIN_WAREHOUSE", label: "Main Warehouse" },
  { value: "BRANCH_STORE", label: "Branch Store" },
  { value: "POS_STORE", label: "POS Store" },
  { value: "EMPLOYEE_STORE", label: "Employee Store" },
  { value: "DAMAGED_STORE", label: "Damaged Store" },
  { value: "RETURN_STORE", label: "Return Store" },
] as const;

const TYPE_BADGE_STYLES: Record<string, string> = {
  MAIN_WAREHOUSE: "border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400",
  BRANCH_STORE: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  POS_STORE: "border-transparent bg-purple-500/10 text-purple-700 dark:text-purple-400",
  EMPLOYEE_STORE: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  DAMAGED_STORE: "border-transparent bg-red-500/10 text-red-700 dark:text-red-400",
  RETURN_STORE: "border-transparent bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

interface LocationsListClientProps {
  locations: any[];
}

export function LocationsListClient({ locations }: LocationsListClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    return locations.filter((l) => {
      if (typeFilter && l.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!l.name.toLowerCase().includes(q) && !l.code.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [locations, typeFilter, search]);

  function handleCreated() {
    setCreateOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Locations" description="Manage warehouses, stores, and stock points">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Location
        </Button>
      </PageHeader>

      <Card className="p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.filter((t) => typeof t.value === "string" && t.value.trim() !== "").map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            {filtered.length} of {locations.length} locations
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              {locations.length === 0 ? "No locations yet" : "No locations match your filters"}
            </p>
            {locations.length === 0 && (
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create your first location
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="block sm:hidden">
              <div className="divide-y">
                {filtered.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => router.push(`/inventory/locations/${loc.id}`)}
                    className="w-full space-y-2 p-4 text-left transition hover:bg-accent/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{loc.name}</p>
                          {loc.isDefault && <Badge variant="secondary" className="text-[10px] shrink-0">Default</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{loc.code}</p>
                      </div>
                      <LocationTypeBadge type={loc.type} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {loc.branch && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {loc.branch.name}
                        </span>
                      )}
                      {loc.assignedEmployee && (
                        <span>Employee: {loc.assignedEmployee.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium">{loc.totalProducts} products</span>
                      <span className="text-muted-foreground">{loc.totalQty} units</span>
              {!loc.isActive && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
              {loc.isSellable && <Badge variant="success" className="text-[10px]">Sellable</Badge>}
              {loc.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((loc) => (
                    <TableRow
                      key={loc.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/inventory/locations/${loc.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{loc.name}</p>
                          </div>
                          {loc.isDefault && <Badge variant="secondary" className="text-[10px] shrink-0">Default</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{loc.code}</code>
                      </TableCell>
                      <TableCell>
                        <LocationTypeBadge type={loc.type} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {loc.branch ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {loc.branch.name}
                          </span>
                        ) : loc.assignedEmployee ? (
                          <span>{loc.assignedEmployee.name}</span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {loc.isActive ? (
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                          ) : (
                            <span className="flex h-2 w-2 rounded-full bg-red-500" />
                          )}
                          <span className="text-xs">{loc.isActive ? "Active" : "Inactive"}</span>
                          {loc.isSellable && (
                            <Badge variant="success" className="text-[10px] ml-1">Sellable</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <span className="flex items-center justify-end gap-1">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          {loc.totalProducts}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{loc.totalQty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      <LocationCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleCreated}
      />
    </div>
  );
}

function LocationTypeBadge({ type }: { type: string }) {
  const label = type.replace(/_/g, " ");
  const className = TYPE_BADGE_STYLES[type] || "";
  return <Badge className={className}>{label}</Badge>;
}
