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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
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
import { getProductLots, createProductLot, getProductsForSelector, getLocationsForSelect } from "@/actions/inventory";
import { toast } from "sonner";

interface ProductLot {
  id: string;
  lotNumber: string;
  serialNumber: string | null;
  productId: string;
  productName: string;
  productSku: string | null;
  trackingMode: string;
  mfgDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  isActive: boolean;
  totalQty: number;
  daysToExpire: number | null;
  locations: { id: string; name: string; quantity: number }[];
  createdAt: string;
}

interface PaginatedData {
  data: ProductLot[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string | null;
}

interface LocationOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface LotsClientProps {
  initialData: PaginatedData;
}

export function LotsClient({ initialData }: LotsClientProps) {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  const loadPage = useCallback(async (newPage: number) => {
    setPage(newPage);
    setLoading(true);
    try {
      const result = await getProductLots({
        page: newPage,
        pageSize: 30,
        productId: productFilter || undefined,
        active: activeOnly || undefined,
        expiringSoon: expiringSoon || undefined,
      });
      setData(result as unknown as PaginatedData);
    } catch {
      toast.error("Failed to load lots");
    } finally {
      setLoading(false);
    }
  }, [productFilter, activeOnly, expiringSoon]);

  useEffect(() => {
    loadPage(1);
  }, [productFilter, activeOnly, expiringSoon, loadPage]);

  const filtered = data.data.filter(
    (lot) =>
      !search ||
      lot.lotNumber.toLowerCase().includes(search.toLowerCase()) ||
      (lot.serialNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      lot.productName.toLowerCase().includes(search.toLowerCase()),
  );

  function getExpiryBadge(days: number | null): { label: string; variant: "success" | "warning" | "destructive" | "secondary" } {
    if (days === null) return { label: "No expiry", variant: "secondary" };
    if (days < 0) return { label: "Expired", variant: "destructive" };
    if (days <= 30) return { label: `${days}d`, variant: "destructive" };
    if (days <= 60) return { label: `${days}d`, variant: "warning" };
    return { label: `${days}d`, variant: "success" };
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lots & Expiry"
        description="Track product lots, serial numbers, and expiry dates"
      >
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Lot
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by lot, serial, or product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-sm"
        />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            Active only
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={expiringSoon}
              onChange={(e) => setExpiringSoon(e.target.checked)}
              className="rounded border-gray-300"
            />
            Expiring soon
          </label>
        </div>
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Package}
              title={search ? "No lots match your search" : "No lots registered yet"}
              description={
                search
                  ? "Try a different search term"
                  : "Register product lots and serial numbers to track expiry and traceability"
              }
              action={
                !search ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Create Lot
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="block sm:hidden">
              <div className="divide-y">
                {filtered.map((lot) => {
                  const eb = getExpiryBadge(lot.daysToExpire);
                  return (
                    <div key={lot.id} className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{lot.productName}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {lot.lotNumber}{lot.serialNumber ? ` / ${lot.serialNumber}` : ""}
                          </p>
                        </div>
                        <Badge variant={eb.variant} className="text-[10px] shrink-0">{eb.label}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>SKU: {lot.productSku || "-"}</span>
                        <span>Qty: {lot.totalQty}</span>
                        {lot.mfgDate && <span>Mfg: {formatDateTime(lot.mfgDate)}</span>}
                        {lot.expiryDate && <span>Exp: {formatDateTime(lot.expiryDate)}</span>}
                        <span>
                          Locations: {lot.locations.map((l) => `${l.name} (${l.quantity})`).join(", ")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Lot / Serial #</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Mfg Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead className="text-right">Days Left</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lot) => {
                    const eb = getExpiryBadge(lot.daysToExpire);
                    return (
                      <TableRow key={lot.id}>
                        <TableCell>
                          <p className="text-sm font-medium truncate max-w-[180px]">{lot.productName}</p>
                          {lot.productSku && (
                            <p className="font-mono text-xs text-muted-foreground">{lot.productSku}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs font-medium">{lot.lotNumber}</p>
                          {lot.serialNumber && (
                            <p className="font-mono text-[10px] text-muted-foreground">SN: {lot.serialNumber}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {lot.locations.map((l) => `${l.name} (${l.quantity})`).join(", ")}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {lot.totalQty}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {lot.mfgDate ? formatDateTime(lot.mfgDate) : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {lot.expiryDate ? formatDateTime(lot.expiryDate) : "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span
                            className={cn(
                              "font-medium",
                              lot.daysToExpire !== null && lot.daysToExpire < 0 && "text-red-600",
                              lot.daysToExpire !== null && lot.daysToExpire >= 0 && lot.daysToExpire <= 30 && "text-red-600",
                              lot.daysToExpire !== null && lot.daysToExpire > 30 && lot.daysToExpire <= 60 && "text-amber-600",
                              lot.daysToExpire !== null && lot.daysToExpire > 60 && "text-green-600",
                            )}
                          >
                            {lot.daysToExpire !== null ? `${lot.daysToExpire}d` : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={eb.variant} className="text-[10px]">{eb.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">{data.total} total lots</p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => loadPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-2 text-sm text-muted-foreground">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages || loading}
                    onClick={() => loadPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <CreateLotDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => loadPage(1)}
      />
    </div>
  );
}

function CreateLotDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [mfgDate, setMfgDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    getLocationsForSelect().then((locs) => setLocations(locs as LocationOption[])).catch(() => {});
    getProductsForSelector().then((prods) => setProducts(prods as ProductOption[])).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!productSearch.trim()) {
      setProductResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await getProductsForSelector(productSearch);
        setProductResults(results as ProductOption[]);
      } catch {
        setProductResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  function resetForm() {
    setProductId("");
    setLocationId("");
    setLotNumber("");
    setSerialNumber("");
    setQuantity(1);
    setMfgDate("");
    setExpiryDate("");
    setNotes("");
    setProductSearch("");
    setProductResults([]);
  }

  async function handleSubmit() {
    const errors: string[] = [];
    if (!productId) errors.push("Product is required");
    if (!locationId) errors.push("Location is required");
    if (!lotNumber.trim()) errors.push("Lot number is required");
    if (quantity <= 0) errors.push("Quantity must be greater than 0");
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    setSaving(true);
    try {
      await createProductLot({
        productId,
        locationId,
        lotNumber: lotNumber.trim(),
        serialNumber: serialNumber.trim() || undefined,
        quantity,
        mfgDate: mfgDate || undefined,
        expiryDate: expiryDate || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Lot created successfully");
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error("Failed to create lot", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Lot / Serial</DialogTitle>
          <DialogDescription>
            Register a new product lot or serial number for traceability.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Product</Label>
            <div className="relative">
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setProductOpen(true);
                }}
                onFocus={() => setProductOpen(true)}
                className="h-9"
              />
              {productOpen && (productSearch || productResults.length > 0) && (
                <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border bg-background shadow-lg">
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
                        {p.sku && <span className="shrink-0 text-xs text-muted-foreground">{p.sku}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.length === 0 ? (
                    <SelectItem value="__loading" disabled>Loading...</SelectItem>
                  ) : (
                    locations.filter((loc) => typeof loc.id === "string" && loc.id.trim() !== "").map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="h-9"
              />
            </div>
          </div>

          <div>
            <Label>Lot Number</Label>
            <Input
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder="e.g. LOT-2024-001"
              className="h-9"
            />
          </div>

          <div>
            <Label>Serial Number (optional)</Label>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="e.g. SN-12345"
              className="h-9"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Manufacturing Date</Label>
              <Input
                type="date"
                value={mfgDate}
                onChange={(e) => setMfgDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder="Optional notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            resetForm();
            onOpenChange(false);
          }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Lot"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
