"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import { getStockLedgerData, getLocationsForSelect } from "@/actions/inventory";

interface LedgerEntry {
  id: string;
  productId: string;
  productName: string;
  productSku: string | null;
  locationId: string;
  locationName: string;
  locationType: string;
  movementType: string;
  quantity: number;
  qtyOnHandBefore: number;
  qtyOnHandAfter: number;
  qtyReservedBefore: number;
  qtyReservedAfter: number;
  reference: string | null;
  referenceId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface LocationOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface PaginatedData {
  data: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

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
  STOCK_COUNT_CORRECTION: "Count Correction",
  DAMAGE: "Damage",
  EXPIRY: "Expiry",
  LOST: "Lost",
  FOUND: "Found",
  INTERNAL_USE: "Internal Use",
};

const movementVariants: Record<string, "default" | "secondary" | "destructive" | "warning" | "success" | "outline"> = {
  OPENING_BALANCE: "default",
  PURCHASE_RECEIVE: "success",
  PURCHASE_RETURN: "warning",
  SALE: "destructive",
  SALE_RETURN: "success",
  TRANSFER_IN: "default",
  TRANSFER_OUT: "warning",
  ADJUSTMENT_IN: "success",
  ADJUSTMENT_OUT: "destructive",
  RESERVATION: "warning",
  RESERVATION_RELEASE: "secondary",
  WRITE_OFF: "destructive",
  STOCK_COUNT_CORRECTION: "default",
  DAMAGE: "destructive",
  EXPIRY: "warning",
  LOST: "outline",
  FOUND: "success",
  INTERNAL_USE: "warning",
};

const movementTypeOptions = Object.keys(movementLabels);

interface StockLedgerClientProps {
  initialData: PaginatedData | null | undefined;
}

const emptyStockLedgerData: PaginatedData = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 50,
  totalPages: 0,
};

function normalizeStockLedgerData(value: PaginatedData | null | undefined): PaginatedData {
  return {
    ...emptyStockLedgerData,
    ...(value || {}),
    data: Array.isArray(value?.data) ? value.data : [],
  };
}

export function StockLedgerClient({ initialData }: StockLedgerClientProps) {
  const [data, setData] = useState<PaginatedData>(() => normalizeStockLedgerData(initialData));
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [movementType, setMovementType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [productResults, setProductResults] = useState<Array<{ id: string; name: string; sku: string | null }>>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);

  const { addToast } = useToast();

  useEffect(() => {
    setData(normalizeStockLedgerData(initialData));
    setPage(1);
  }, [initialData]);

  useEffect(() => {
    getLocationsForSelect()
      .then((result) => setLocations(result as LocationOption[]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!productSearch.trim()) {
      setProductResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/inventory?search=${encodeURIComponent(productSearch)}&pageSize=20`);
        const json = await res.json();
        if (json.success) {
          setProductResults(
            json.data.data.map((p: { id: string; name: string; sku: string | null }) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
            })),
          );
        }
      } catch {
        setProductResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const fetchData = useCallback(
    async (newPage: number) => {
      setLoading(true);
      try {
        const result = await getStockLedgerData({
          productId: productId || undefined,
          locationId: locationId && locationId !== "all" ? locationId : undefined,
          movementType: movementType && movementType !== "all" ? movementType : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page: newPage,
          pageSize: 50,
        });
        setData(normalizeStockLedgerData(result as unknown as PaginatedData));
      } catch {
        addToast({ title: "Failed to load ledger", variant: "error" });
      } finally {
        setLoading(false);
      }
    },
    [productId, locationId, movementType, dateFrom, dateTo, addToast],
  );

  function applyFilters() {
    setPage(1);
    fetchData(1);
  }

  function clearFilters() {
    setProductId("");
    setProductSearch("");
    setLocationId("");
    setMovementType("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchData(newPage);
  }

  const hasFilters = productId || locationId || movementType || dateFrom || dateTo;

  const isPositive = (qty: number) => qty >= 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Ledger"
        description="Complete audit trail of all stock movements across locations"
      />

      {/* Filter Panel */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="relative min-w-[200px] flex-1" ref={productRef}>
            <Label className="text-xs">Product</Label>
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
            {productId && !productOpen && (
              <button
                onClick={() => {
                  setProductId("");
                  setProductSearch("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {productOpen && (productSearch || productResults.length > 0) && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded border bg-background shadow-lg">
                {searching ? (
                  <div className="p-2 text-sm text-muted-foreground">Searching...</div>
                ) : productResults.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No products found</div>
                ) : (
                  productResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setProductId(p.id);
                        setProductSearch(p.name);
                        setProductOpen(false);
                      }}
                    >
                      <span className="truncate">{p.name}</span>
                      {p.sku && (
                        <span className="shrink-0 text-xs text-muted-foreground">{p.sku}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">Location</Label>
            <Select value={locationId || "all"} onValueChange={(value) => setLocationId(value === "all" ? "" : value)}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.filter((loc) => typeof loc.id === "string" && loc.id.trim() !== "").map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Movement Type</Label>
            <Select value={movementType || "all"} onValueChange={(value) => setMovementType(value === "all" ? "" : value)}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {movementTypeOptions.filter((type) => typeof type === "string" && type.trim() !== "").map((type) => (
                  <SelectItem key={type} value={type}>
                    {movementLabels[type] || type.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-9" onClick={applyFilters}>
              <Search className="mr-1.5 h-3.5 w-3.5" /> Search
            </Button>
            {hasFilters && (
              <Button size="sm" variant="ghost" className="h-9" onClick={clearFilters}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Results */}
      <Card className="p-0">
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={8} />
          </div>
        ) : data.data.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No ledger entries found. Try adjusting your filters.
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="block sm:hidden">
              <div className="divide-y">
                {data.data.map((entry) => (
                  <div key={entry.id} className="space-y-1.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{entry.productName || "Unknown product"}</p>
                      </div>
                      <Badge
                        variant={movementVariants[entry.movementType] || "secondary"}
                        className="shrink-0 text-[10px]"
                      >
                        {movementLabels[entry.movementType] || entry.movementType.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatDateTime(entry.createdAt)}</span>
                      <span>{entry.locationName || "Unknown location"}</span>
                      <span>
                        Qty:{" "}
                        <span
                          className={
                            isPositive(entry.quantity)
                              ? "font-medium text-green-600"
                              : "font-medium text-red-600"
                          }
                        >
                          {isPositive(entry.quantity) ? `+${entry.quantity}` : entry.quantity}
                        </span>
                      </span>
                      <span>Balance: {entry.qtyOnHandAfter}</span>
                      <span>Ref: {entry.reference || "-"}</span>
                      <span>By: {entry.createdBy || "-"}</span>
                    </div>
                    {entry.notes && (
                      <p className="truncate text-xs text-muted-foreground">{entry.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Movement Type</TableHead>
                    <TableHead className="text-right">Qty In</TableHead>
                    <TableHead className="text-right">Qty Out</TableHead>
                    <TableHead className="text-right">Balance After</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((entry) => {
                    const positive = isPositive(entry.quantity);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{entry.productName || "Unknown product"}</p>
                            {entry.productSku && (
                              <p className="font-mono text-xs text-muted-foreground">{entry.productSku}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{entry.locationName || "Unknown location"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={movementVariants[entry.movementType] || "secondary"}
                            className="text-[10px] whitespace-nowrap"
                          >
                            {movementLabels[entry.movementType] || entry.movementType.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {positive ? (
                            <span className="font-medium text-green-600">
                              +{entry.quantity}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!positive ? (
                            <span className="font-medium text-red-600">
                              {Math.abs(entry.quantity)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {entry.qtyOnHandAfter}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate font-mono text-xs text-muted-foreground">
                          {entry.reference || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.createdBy || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(data.page - 1) * data.pageSize + 1}-
                  {Math.min(data.page * data.pageSize, data.total)} of {data.total}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Prev
                  </Button>
                  <span className="mx-2 text-sm text-muted-foreground">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages || loading}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
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
