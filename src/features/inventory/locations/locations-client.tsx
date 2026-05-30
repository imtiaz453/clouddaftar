"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useCallback, useMemo } from "react";
import {
  Search, Plus, Eye, Pencil, Trash2,
  MapPin, Building2, UserCircle,
  CheckCircle, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionsMenu } from "@/components/shared/actions-menu";
import { getInventoryLocations, deleteInventoryLocation } from "@/actions/inventory";
import { toast } from "sonner";
import { LocationFormDialog } from "./location-form-dialog";

const LOCATION_TYPES = [
  { value: "", label: "All Types" },
  { value: "MAIN_WAREHOUSE", label: "Main Warehouse" },
  { value: "BRANCH_STORE", label: "Branch Store" },
  { value: "POS_STORE", label: "POS Store" },
  { value: "EMPLOYEE_STORE", label: "Employee Store" },
  { value: "DAMAGED_STORE", label: "Damaged Stock" },
  { value: "RETURN_STORE", label: "Return Stock" },
] as const;

const TYPE_BADGE_STYLES: Record<string, string> = {
  MAIN_WAREHOUSE: "border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400",
  BRANCH_STORE: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  POS_STORE: "border-transparent bg-purple-500/10 text-purple-700 dark:text-purple-400",
  EMPLOYEE_STORE: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  DAMAGED_STORE: "border-transparent bg-red-500/10 text-red-700 dark:text-red-400",
  RETURN_STORE: "border-transparent bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

const PAGE_SIZE = 15;

interface LocationRow {
  id: string;
  name: string;
  code: string;
  type: string;
  isDefault: boolean;
  isActive: boolean;
  isSellable: boolean;
  branch: { id: string; name: string } | null;
  assignedEmployee: { id: string; name: string } | null;
  address: string | null;
  notes: string | null;
  totalProducts: number;
  totalQty: number;
}

interface LocationsClientProps {
  initialLocations?: LocationRow[];
}

export function LocationsClient({ initialLocations }: LocationsClientProps) {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationRow[]>(initialLocations ?? []);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLocation, setEditLocation] = useState<LocationRow | null>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getInventoryLocations({
        search: search || undefined,
        type: typeFilter || undefined,
      });
      setLocations(result as unknown as LocationRow[]);
    } catch (err) {
      toast.error("Failed to load locations", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  const filtered = useMemo(() => {
    let list = locations;
    if (typeFilter) {
      list = list.filter((l) => l.type === typeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
    }
    return list;
  }, [locations, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleTypeFilter(value: string) {
    setTypeFilter(value);
    setPage(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handleAdd() {
    setEditLocation(null);
    setDialogOpen(true);
  }

  function handleEdit(location: LocationRow) {
    setEditLocation(location);
    setDialogOpen(true);
  }

  async function handleDelete(locationId: string) {
    try {
      await deleteInventoryLocation(locationId);
      toast.success("Location deleted");
      fetchLocations();
      router.refresh();
    } catch (err) {
      toast.error("Error deleting location", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  function onDialogSuccess() {
    setDialogOpen(false);
    setEditLocation(null);
    fetchLocations();
    router.refresh();
  }

  const totalCount = filtered.length;

  return (
    <div className="space-y-5">
      <PageHeader title="Stock Locations" description="Manage warehouses, stores, and stock points">
        <Button size="sm" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> New Location
        </Button>
      </PageHeader>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={typeFilter} onValueChange={handleTypeFilter}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!loading && (
          <div className="mt-2 text-xs text-muted-foreground">
            {totalCount} location{totalCount !== 1 ? "s" : ""}
          </div>
        )}
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No locations found"
          description="Try adjusting your filters or create a new location"
          action={
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" /> New Location
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:hidden">
            {paginated.map((loc) => (
              <Card key={loc.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/inventory/locations/${loc.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {loc.name}
                      </Link>
                      {loc.isDefault && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">Default</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{loc.code}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge className={TYPE_BADGE_STYLES[loc.type] || ""}>
                      {LOCATION_TYPES.find((t) => t.value === loc.type)?.label || loc.type}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {loc.branch && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {loc.branch.name}
                    </span>
                  )}
                  {loc.assignedEmployee && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <UserCircle className="h-3 w-3" />
                      {loc.assignedEmployee.name}
                    </span>
                  )}
                  <span className="text-xs">{loc.totalProducts} products</span>
                  <span className="text-xs text-muted-foreground">{loc.totalQty} units</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {loc.isActive ? (
                    <Badge variant="success" className="text-[10px]">Active</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                  )}
                  {loc.isSellable && (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">Sellable</Badge>
                  )}
                </div>
                <div className="mt-2 flex justify-end">
                  <ActionsMenu
                    compact
                    items={[
                      { label: "View Detail", icon: Eye, onSelect: () => router.push(`/inventory/locations/${loc.id}`) },
                      { label: "Edit", icon: Pencil, onSelect: () => handleEdit(loc) },
                      { label: "Delete", icon: Trash2, onSelect: () => handleDelete(loc.id), destructive: true, separatorBefore: true },
                    ]}
                  />
                </div>
              </Card>
            ))}
          </div>

          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Assigned Employee</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <Link
                            href={`/inventory/locations/${loc.id}`}
                            className="truncate font-medium hover:underline"
                          >
                            {loc.name}
                          </Link>
                        </div>
                        {loc.isDefault && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">Default</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{loc.code}</code>
                    </TableCell>
                    <TableCell>
                      <Badge className={TYPE_BADGE_STYLES[loc.type] || ""}>
                        {LOCATION_TYPES.find((t) => t.value === loc.type)?.label || loc.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {loc.branch ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {loc.branch.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {loc.assignedEmployee ? (
                        <span className="inline-flex items-center gap-1">
                          <UserCircle className="h-3 w-3" />
                          {loc.assignedEmployee.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{loc.totalProducts}</TableCell>
                    <TableCell className="text-right font-medium">{loc.totalQty}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {loc.isActive ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-xs">{loc.isActive ? "Active" : "Inactive"}</span>
                        {loc.isSellable && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 ml-1">Sellable</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ActionsMenu
                        compact
                        items={[
                          { label: "View Detail", icon: Eye, onSelect: () => router.push(`/inventory/locations/${loc.id}`) },
                          { label: "Edit", icon: Pencil, onSelect: () => handleEdit(loc) },
                          { label: "Delete", icon: Trash2, onSelect: () => handleDelete(loc.id), destructive: true, separatorBefore: true },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <LocationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        location={editLocation}
        onSuccess={onDialogSuccess}
      />
    </div>
  );
}
