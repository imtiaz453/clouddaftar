"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Truck,
  ArrowRightLeft,
  Package,
  Search,
  Plus,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import { getStockTransfers, getLocationsForSelect } from "@/actions/inventory";
import { TransferCreateDialog } from "./transfer-create-dialog";

interface Location {
  id: string;
  name: string;
  code: string;
  [key: string]: unknown;
}

interface TransferItem {
  id: string;
  quantity: number;
  product?: { name?: string | null; sku?: string | null } | null;
}

interface Transfer {
  id: string;
  referenceNumber: string;
  status: string;
  sourceLocation?: Location | null;
  destinationLocation?: Location | null;
  createdBy?: { id?: string; name?: string | null } | null;
  items?: TransferItem[] | null;
  createdAt: string;
  issuedAt?: string | null;
  receivedAt?: string | null;
}

interface PaginatedResult {
  data: Transfer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface TransfersListClientProps {
  initialData: PaginatedResult;
}

const ALL_STATUSES = "ALL";

const EMPTY_DATA: PaginatedResult = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
};

const STATUS_OPTIONS = [
  { value: ALL_STATUSES, label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "ISSUED", label: "Issued" },
  { value: "PARTIALLY_RECEIVED", label: "Partially Received" },
  { value: "RECEIVED", label: "Received" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ISSUED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  RECEIVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  IN_TRANSIT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function normalizePaginatedResult(result: unknown): PaginatedResult {
  if (!result || typeof result !== "object") return EMPTY_DATA;

  const value = result as Partial<PaginatedResult> & { data?: unknown };
  const data = Array.isArray(value.data) ? (value.data as Transfer[]) : [];

  return {
    data,
    total: typeof value.total === "number" ? value.total : data.length,
    page: typeof value.page === "number" && value.page > 0 ? value.page : 1,
    pageSize: typeof value.pageSize === "number" && value.pageSize > 0 ? value.pageSize : 20,
    totalPages:
      typeof value.totalPages === "number" && value.totalPages >= 0
        ? value.totalPages
        : data.length > 0
          ? 1
          : 0,
  };
}

function normalizeLocations(locations: unknown): Location[] {
  if (!Array.isArray(locations)) return [];

  return locations
    .filter((loc): loc is Location => {
      if (!loc || typeof loc !== "object") return false;
      const value = loc as Partial<Location>;
      return typeof value.id === "string" && value.id.trim().length > 0;
    })
    .map((loc) => ({
      id: loc.id,
      name: loc.name || "Unnamed location",
      code: loc.code || "—",
    }));
}

function getStatusLabel(status: string) {
  return status ? status.replace(/_/g, " ") : "UNKNOWN";
}

export function TransfersListClient({ initialData }: TransfersListClientProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const safeInitialData = useMemo(() => normalizePaginatedResult(initialData), [initialData]);

  const [data, setData] = useState<PaginatedResult>(safeInitialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams?.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams?.get("status") || ALL_STATUSES);
  const [createOpen, setCreateOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    setData(safeInitialData);
  }, [safeInitialData]);

  useEffect(() => {
    let alive = true;

    async function loadLocations() {
      try {
        const locs = await getLocationsForSelect();
        if (alive) setLocations(normalizeLocations(locs));
      } catch (error) {
        console.error("Failed to load transfer locations:", error);
        if (alive) setLocations([]);
      }
    }

    loadLocations();

    return () => {
      alive = false;
    };
  }, []);

  const loadData = useCallback(
    async (params: { status?: string; search?: string; page?: number }) => {
      setLoading(true);
      try {
        const selectedStatus = params.status && params.status !== ALL_STATUSES ? params.status : undefined;
        const result = await getStockTransfers({
          status: selectedStatus,
          search: params.search?.trim() || undefined,
          page: params.page || 1,
          pageSize: 20,
        } as any);

        setData(normalizePaginatedResult(result));
      } catch (err) {
        console.error("Failed to load transfers:", err);
        addToast({
          title: "Failed to load transfers",
          description: err instanceof Error ? err.message : String(err),
          variant: "error",
        });
        setData(EMPTY_DATA);
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );

  function updateUrl(params: { status?: string; search?: string; page?: number }) {
    const nextParams = new URLSearchParams(searchParams?.toString() ?? "");

    const selectedStatus = params.status ?? statusFilter;
    const selectedSearch = params.search ?? search;
    const selectedPage = params.page ?? 1;

    if (selectedStatus && selectedStatus !== ALL_STATUSES) nextParams.set("status", selectedStatus);
    else nextParams.delete("status");

    if (selectedSearch.trim()) nextParams.set("search", selectedSearch.trim());
    else nextParams.delete("search");

    if (selectedPage > 1) nextParams.set("page", String(selectedPage));
    else nextParams.delete("page");

    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    updateUrl({ status: value, search, page: 1 });
    loadData({ status: value, search, page: 1 });
  }

  function handleSearch(value: string) {
    setSearch(value);
  }

  function handleSearchSubmit() {
    updateUrl({ status: statusFilter, search, page: 1 });
    loadData({ status: statusFilter, search, page: 1 });
  }

  function goToPage(page: number) {
    updateUrl({ status: statusFilter, search, page });
    loadData({ status: statusFilter, search, page });
  }

  function viewDetail(id: string) {
    if (!id) return;
    router.push(`${pathname}/${id}`);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Transfers"
        description="Manage inventory movements between locations"
      >
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Transfer
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by reference..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : data.data.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <Truck className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">No stock transfers found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a transfer to move stock between locations
          </p>
        </Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((t) => {
                  const items = Array.isArray(t.items) ? t.items : [];
                  const status = t.status || "UNKNOWN";

                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => viewDetail(t.id)}
                    >
                      <TableCell className="font-medium">
                        {t.referenceNumber || "Untitled transfer"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.sourceLocation?.name || "Unknown source"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.destinationLocation?.name || "Unknown destination"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`border-0 ${STATUS_STYLES[status] || "bg-muted text-muted-foreground"}`}
                          variant="outline"
                        >
                          {getStatusLabel(status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {items.length}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.createdAt ? formatDate(t.createdAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            viewDetail(t.id);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {data.data.map((t) => {
              const items = Array.isArray(t.items) ? t.items : [];
              const status = t.status || "UNKNOWN";

              return (
                <Card
                  key={t.id}
                  className="cursor-pointer p-4 transition hover:bg-accent/50"
                  onClick={() => viewDetail(t.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{t.referenceNumber || "Untitled transfer"}</span>
                    <Badge
                      className={`border-0 ${STATUS_STYLES[status] || "bg-muted text-muted-foreground"}`}
                      variant="outline"
                    >
                      {getStatusLabel(status)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="truncate">{t.sourceLocation?.name || "Unknown source"}</span>
                    <ArrowRightLeft className="h-3 w-3 shrink-0" />
                    <span className="truncate">{t.destinationLocation?.name || "Unknown destination"}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {items.length} items
                    </span>
                    <span>{t.createdAt ? formatDate(t.createdAt) : "—"}</span>
                  </div>
                </Card>
              );
            })}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {data.page} of {data.totalPages} ({data.total} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => goToPage(data.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.totalPages}
                  onClick={() => goToPage(data.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <TransferCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        locations={locations}
      />
    </div>
  );
}
