"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Search, Plus, MoreHorizontal, Eye, ArrowUpDown, Truck, CheckCircle, XCircle, Loader2, AlertCircle, Package, ClipboardList, FileText, TrendingUp, AlertTriangle, Calendar, Clock, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { formatDateTime, cn } from "@/lib/utils";
import { getStockLedgerData, getStockMovementTypes, getProductsForSelector, getLocationsForSelect } from "@/actions/inventory";
import { toast } from "sonner";

interface LedgerEntry {
  id: string;
  movementType: string;
  quantity: number;
  qtyOnHandBefore: number;
  qtyOnHandAfter: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  product?: { id: string; name: string; sku: string | null };
  location?: { id: string; name: string };
  createdBy?: { id: string; name?: string | null; email?: string | null } | string | null;
  productId?: string;
  productName?: string;
  productSku?: string | null;
  locationId?: string;
  locationName?: string;
  createdByName?: string | null;
}

interface PaginatedData {
  data: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
}

interface LocationOption {
  id: string;
  name: string;
}

const movementTypeVariants: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  OPENING_BALANCE: "default",
  PURCHASE_RECEIVE: "success",
  PURCHASE_RETURN: "warning",
  SALE: "destructive",
  SALE_RETURN: "success",
  TRANSFER_IN: "default",
  TRANSFER_OUT: "warning",
  ADJUSTMENT_IN: "secondary",
  ADJUSTMENT_OUT: "destructive",
  RESERVATION: "outline",
  RESERVATION_RELEASE: "secondary",
  WRITE_OFF: "destructive",
  STOCK_COUNT_CORRECTION: "secondary",
  DAMAGE: "destructive",
  EXPIRY: "warning",
  LOST: "outline",
  FOUND: "default",
  INTERNAL_USE: "warning",
};

const movementLabels: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance",
  PURCHASE_RECEIVE: "Purchase Receive",
  PURCHASE_RETURN: "Purchase Return",
  SALE: "Sale",
  SALE_RETURN: "Sale Return",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  ADJUSTMENT_IN: "Adjustment In",
  ADJUSTMENT_OUT: "Adjustment Out",
  RESERVATION: "Reservation",
  RESERVATION_RELEASE: "Reservation Release",
  WRITE_OFF: "Write Off",
  STOCK_COUNT_CORRECTION: "Stock Count Correction",
  DAMAGE: "Damage",
  EXPIRY: "Expiry",
  LOST: "Lost",
  FOUND: "Found",
  INTERNAL_USE: "Internal Use",
};

interface LedgerClientProps {
  initialData: PaginatedData | null | undefined;
}

const emptyLedgerData: PaginatedData = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 50,
  totalPages: 0,
};

function normalizeLedgerData(value: PaginatedData | null | undefined): PaginatedData {
  return {
    ...emptyLedgerData,
    ...(value || {}),
    data: Array.isArray(value?.data) ? value.data : [],
  };
}

export function LedgerClient({ initialData }: LedgerClientProps) {
  const [data, setData] = useState<PaginatedData>(() => normalizeLedgerData(initialData));
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [movementType, setMovementType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reference, setReference] = useState("");

  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [movementTypes, setMovementTypes] = useState<string[]>([]);

  useEffect(() => {
    setData(normalizeLedgerData(initialData));
    setPage(1);
  }, [initialData]);

  useEffect(() => {
    getLocationsForSelect().then((locs) => setLocations(locs as LocationOption[])).catch(() => {});
    getStockMovementTypes().then((types) => setMovementTypes(types as string[])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!productSearch.trim()) {
      setProductResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await getProductsForSelector(productSearch);
        setProductResults(results as ProductOption[]);
      } catch {
        setProductResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await getStockLedgerData({
        productId: productId || undefined,
        locationId: locationId && locationId !== "all" ? locationId : undefined,
        movementType: movementType && movementType !== "all" ? movementType : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        reference: reference || undefined,
        page: p,
        pageSize: 50,
      });
      setData(normalizeLedgerData(result as unknown as PaginatedData));
      setPage(p);
    } catch {
      toast.error("Failed to load ledger entries");
    } finally {
      setLoading(false);
    }
  }, [productId, locationId, movementType, dateFrom, dateTo, reference]);

  function applyFilters() {
    fetchData(1);
  }

  function clearFilters() {
    setProductId("");
    setProductSearch("");
    setLocationId("");
    setMovementType("");
    setDateFrom("");
    setDateTo("");
    setReference("");
    setPage(1);
  }

  function handlePageChange(newPage: number) {
    fetchData(newPage);
  }

  function getProductName(entry: LedgerEntry) {
    return entry.productName || entry.product?.name || "Unknown product";
  }

  function getProductSku(entry: LedgerEntry) {
    return entry.productSku || entry.product?.sku || null;
  }

  function getLocationName(entry: LedgerEntry) {
    return entry.locationName || entry.location?.name || "Unknown location";
  }

  function getCreatedBy(entry: LedgerEntry) {
    if (typeof entry.createdBy === "string") return entry.createdBy;
    return entry.createdByName || entry.createdBy?.name || entry.createdBy?.email || "-";
  }

  const hasFilters = productId || locationId || movementType || dateFrom || dateTo || reference;

  return (
    <div className="space-y-5">
      <PageHeader title="Stock Ledger" description="Complete audit trail of all stock movements" />

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="relative flex-1 min-w-[180px]">
            <p className="mb-1 text-xs text-muted-foreground">Product</p>
            <Input
              placeholder="Search product..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setProductOpen(true);
              }}
              onFocus={() => setProductOpen(true)}
              className="h-9"
            />
            {productOpen && productResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border bg-background shadow-lg">
                {productResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProductId(p.id);
                      setProductSearch(p.name);
                      setProductOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    {p.name} {p.sku && <span className="text-muted-foreground">({p.sku})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Location</p>
            <Select value={locationId || "all"} onValueChange={(value) => setLocationId(value === "all" ? "" : value)}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.filter((l) => typeof l.id === "string" && l.id.trim() !== "").map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Movement Type</p>
            <Select value={movementType || "all"} onValueChange={(value) => setMovementType(value === "all" ? "" : value)}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {movementTypes.filter((t) => typeof t === "string" && t.trim() !== "").map((t) => (
                  <SelectItem key={t} value={t}>
                    {movementLabels[t] || t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">From</p>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">To</p>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Reference</p>
            <Input
              placeholder="Invoice/PO #"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={applyFilters}>
              <Search className="mr-1.5 h-3.5 w-3.5" /> Search
            </Button>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : data.data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ClipboardList}
              title={hasFilters ? "No entries match your filters" : "No ledger entries yet"}
              description={
                hasFilters
                  ? "Try adjusting your filter criteria"
                  : "Stock movements will appear here as inventory transactions occur"
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Movement Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-[200px] truncate">
                        {getProductName(entry)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {getProductSku(entry) || "-"}
                      </TableCell>
                      <TableCell className="text-xs">{getLocationName(entry)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={movementTypeVariants[entry.movementType] || "secondary"}
                          className="text-[10px] whitespace-nowrap"
                        >
                          {movementLabels[entry.movementType] || entry.movementType.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          Number(entry.quantity) > 0 ? "text-green-600" : "text-red-600",
                        )}
                      >
                        {Number(entry.quantity) > 0 ? "+" : ""}{Number(entry.quantity)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {Number(entry.qtyOnHandBefore)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {Number(entry.qtyOnHandAfter)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate font-mono">
                        {entry.reference || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {getCreatedBy(entry)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">{data.total} total entries</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages || loading}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
