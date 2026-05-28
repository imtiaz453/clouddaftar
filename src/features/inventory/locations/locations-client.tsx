"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Building2, Package, ArrowLeft, Plus, History, ArrowRightLeft,
  ClipboardCheck, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";

interface LocationSummary {
  id: string; name: string; code: string; type: string;
  isDefault: boolean; isActive: boolean;
  totalProducts: number; totalQty: number;
}

interface BalanceItem {
  id: string; qtyOnHand: number; qtyReserved: number; qtyAvailable: number;
  product: { id: string; name: string; sku: string | null; sellingPrice: number; purchasePrice: number; unit: string };
}

interface LedgerEntry {
  id: string; movementType: string; quantity: number;
  qtyOnHandBefore: number; qtyOnHandAfter: number;
  notes: string | null; createdAt: string;
  product: { name: string };
  createdBy: { name: string; email: string } | null;
}

interface ProductOption {
  id: string; name: string; sku: string | null;
}

interface LocationsClientProps {
  locations: LocationSummary[];
  locationDetail?: { location: any; balances: BalanceItem[]; recentLedger: LedgerEntry[] } | null;
  products: ProductOption[];
  locationId?: string | null;
}

export function LocationsClient({ locations, locationDetail, products, locationId }: LocationsClientProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const { addToast } = useToast();

  const [selectedLocation, setSelectedLocation] = useState(locationId || null);
  const [detail, setDetail] = useState(locationDetail);
  const [detailLoading, setDetailLoading] = useState(false);

  // Transfer dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferForm, setTransferForm] = useState({ productId: "", toLocationId: "", quantity: 1, notes: "" });

  // Adjust dialog
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ productId: "", direction: "IN" as "IN" | "OUT", quantity: 1, reason: "", notes: "" });

  useEffect(() => {
    setSelectedLocation(locationId || null);
  }, [locationId]);

  useEffect(() => {
    setDetail(locationDetail);
  }, [locationDetail]);

  const loadDetail = useCallback(async (locId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/inventory/locations/${locId}`);
      const json = await res.json();
      if (json.success) setDetail(json.data);
    } catch {
      addToast({ title: "Failed to load location", variant: "error" });
    } finally {
      setDetailLoading(false);
    }
  }, [addToast]);

  function selectLocation(id: string) {
    setSelectedLocation(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("locationId", id);
    router.push(`${pathname}?${params}`);
    if (!locationDetail) loadDetail(id);
  }

  function backToList() {
    setSelectedLocation(null);
    router.push(pathname);
  }

  const [transferProductSearch, setTransferProductSearch] = useState("");
  const [adjustProductSearch, setAdjustProductSearch] = useState("");
  const transferFiltered = products.filter((p) =>
    p.name.toLowerCase().includes(transferProductSearch.toLowerCase()) ||
    (p.sku || "").toLowerCase().includes(transferProductSearch.toLowerCase()),
  );
  const adjustFiltered = products.filter((p) =>
    p.name.toLowerCase().includes(adjustProductSearch.toLowerCase()) ||
    (p.sku || "").toLowerCase().includes(adjustProductSearch.toLowerCase()),
  );
  const otherLocations = locations.filter((l) => l.id !== selectedLocation);

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferForm.productId || !transferForm.toLocationId) return;
    setTransferSaving(true);
    try {
      const res = await fetch("/api/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: transferForm.productId,
          fromWarehouseId: selectedLocation,
          toWarehouseId: transferForm.toLocationId,
          quantity: transferForm.quantity,
          notes: transferForm.notes || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) throw new Error(data?.error || "Transfer failed");
      addToast({ title: "Stock transferred", variant: "success" });
      setTransferOpen(false);
      setTransferForm({ productId: "", toLocationId: "", quantity: 1, notes: "" });
      if (selectedLocation) loadDetail(selectedLocation);
    } catch (err) {
      addToast({ title: "Transfer failed", description: String(err), variant: "error" });
    } finally {
      setTransferSaving(false);
    }
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustForm.productId) return;
    setAdjustSaving(true);
    try {
      const res = await fetch("/api/inventory/adjust-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: adjustForm.productId,
          warehouseId: selectedLocation,
          quantity: adjustForm.quantity,
          type: adjustForm.direction === "IN" ? "ADJUSTMENT" : "ADJUSTMENT",
          notes: adjustForm.reason ? `${adjustForm.reason}${adjustForm.notes ? ` - ${adjustForm.notes}` : ""}` : adjustForm.notes,
        }),
      });
      if (!res.ok) throw new Error("Adjustment failed");
      addToast({ title: "Stock adjusted", variant: "success" });
      setAdjustOpen(false);
      setAdjustForm({ productId: "", direction: "IN", quantity: 1, reason: "", notes: "" });
      if (selectedLocation) loadDetail(selectedLocation);
    } catch (err) {
      addToast({ title: "Adjustment failed", description: String(err), variant: "error" });
    } finally {
      setAdjustSaving(false);
    }
  }

  // Detail view
  if (selectedLocation && detail) {
    const loc = detail.location;
    const totalValue = detail.balances.reduce((s, b) => s + Number(b.qtyOnHand) * Number(b.product.purchasePrice), 0);
    const totalReserved = detail.balances.reduce((s, b) => s + Number(b.qtyReserved), 0);
    const totalAvailable = detail.balances.reduce((s, b) => s + Number(b.qtyAvailable), 0);

    return (
      <div className="space-y-5">
        <PageHeader title={loc.name} description={`${loc.code} · ${loc.type.replace(/_/g, " ")}`}>
          <Button variant="ghost" size="sm" onClick={backToList}>
            <ArrowLeft className="mr-2 h-4 w-4" /> All Locations
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}>
            <ClipboardCheck className="mr-2 h-4 w-4" /> Adjust
          </Button>
        </PageHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Products</p>
            <p className="mt-1 text-xl font-semibold">{detail.balances.length}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">On Hand / Reserved / Available</p>
            <p className="mt-1 text-xl font-semibold">
              {detail.balances.reduce((s, b) => s + Number(b.qtyOnHand), 0)}
              <span className="text-sm text-muted-foreground"> / {totalReserved} / {totalAvailable}</span>
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Stock Value</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(totalValue)}</p>
          </Card>
        </div>

        <Card>
          <div className="border-b border-border/60 p-3">
            <h3 className="text-sm font-medium">Items</h3>
          </div>
          {detail.balances.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No stock at this location</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>On Hand</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.balances.map((b: BalanceItem) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.product.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.product.sku}</TableCell>
                    <TableCell>{Number(b.qtyOnHand)}</TableCell>
                    <TableCell className="text-muted-foreground">{Number(b.qtyReserved)}</TableCell>
                    <TableCell>{Number(b.qtyAvailable)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrency(Number(b.qtyOnHand) * Number(b.product.purchasePrice))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 border-b border-border/60 p-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Recent Movements</h3>
          </div>
          {detail.recentLedger.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No recent movements</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead>After</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.recentLedger.map((e: LedgerEntry) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{formatDate(e.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{e.movementType.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{e.product.name}</TableCell>
                    <TableCell className="font-medium">{Number(e.quantity)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{Number(e.qtyOnHandBefore)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{Number(e.qtyOnHandAfter)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.notes || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Transfer Dialog */}
        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Transfer Stock</DialogTitle></DialogHeader>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-medium">Product</p>
                <Input placeholder="Search product..." value={transferProductSearch} onChange={(e) => setTransferProductSearch(e.target.value)} />
                <div className="mt-1 max-h-40 overflow-y-auto rounded border">
                  {transferFiltered.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setTransferForm((f) => ({ ...f, productId: p.id })); setTransferProductSearch(p.name); }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-accent ${transferForm.productId === p.id ? "bg-accent font-medium" : ""}`}>
                      {p.name} {p.sku && <span className="text-muted-foreground">({p.sku})</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">From</p>
                <p className="text-sm">{detail.location.name}</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">To</p>
                <Select value={transferForm.toLocationId} onValueChange={(v) => setTransferForm((f) => ({ ...f, toLocationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {otherLocations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Quantity</p>
                <Input type="number" min={1} value={transferForm.quantity} onChange={(e) => setTransferForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Notes (optional)</p>
                <Input value={transferForm.notes} onChange={(e) => setTransferForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setTransferOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={transferSaving || !transferForm.productId || !transferForm.toLocationId}>
                  {transferSaving ? <LoadingSpinner size={4} /> : "Transfer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Adjust Dialog */}
        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-medium">Product</p>
                <Input placeholder="Search product..." value={adjustProductSearch} onChange={(e) => setAdjustProductSearch(e.target.value)} />
                <div className="mt-1 max-h-40 overflow-y-auto rounded border">
                  {adjustFiltered.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setAdjustForm((f) => ({ ...f, productId: p.id })); setAdjustProductSearch(p.name); }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-accent ${adjustForm.productId === p.id ? "bg-accent font-medium" : ""}`}>
                      {p.name} {p.sku && <span className="text-muted-foreground">({p.sku})</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Direction</p>
                <Select value={adjustForm.direction} onValueChange={(v: "IN" | "OUT") => setAdjustForm((f) => ({ ...f, direction: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Increase (Stock In)</SelectItem>
                    <SelectItem value="OUT">Decrease (Stock Out)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Quantity</p>
                <Input type="number" min={1} value={adjustForm.quantity} onChange={(e) => setAdjustForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Reason</p>
                <Input value={adjustForm.reason} onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Damaged, Found, etc." />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Notes (optional)</p>
                <Input value={adjustForm.notes} onChange={(e) => setAdjustForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setAdjustOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={adjustSaving || !adjustForm.productId}>
                  {adjustSaving ? <LoadingSpinner size={4} /> : "Adjust"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-5">
      <PageHeader title="Stock Locations" description="Manage warehouses, stores, and stock points">
        <Button variant="ghost" size="sm" onClick={() => router.push(`${pathname}/../warehouses`)}>
          <Building2 className="mr-2 h-4 w-4" /> Warehouses (Legacy)
        </Button>
      </PageHeader>

      {detailLoading ? (
        <TableSkeleton />
      ) : locations.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No locations found</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {locations.map((loc) => (
            <button key={loc.id} type="button" onClick={() => selectLocation(loc.id)}
              className="rounded-lg border bg-background p-4 text-left transition hover:bg-accent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{loc.name}</p>
                </div>
                {loc.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{loc.code} · {loc.type.replace(/_/g, " ")}</p>
              <div className="mt-2 flex gap-3 text-sm">
                <span>{loc.totalProducts} products</span>
                <span className="text-muted-foreground">{loc.totalQty} units</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
