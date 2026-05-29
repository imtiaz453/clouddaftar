"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, Package, Edit, Search, X, MapPin, User,
  ShoppingCart, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { LocationCreateDialog } from "./location-create-dialog";

const TYPE_BADGE_STYLES: Record<string, string> = {
  MAIN_WAREHOUSE: "border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400",
  BRANCH_STORE: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  POS_STORE: "border-transparent bg-purple-500/10 text-purple-700 dark:text-purple-400",
  EMPLOYEE_STORE: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  DAMAGED_STORE: "border-transparent bg-red-500/10 text-red-700 dark:text-red-400",
  RETURN_STORE: "border-transparent bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

interface BalanceItem {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string | null;
  unit: string | null;
  categoryName: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  averageCost: number;
  stockValue: number;
}

interface LedgerEntry {
  id: string;
  movementType: string;
  quantity: number;
  qtyOnHandBefore: number;
  qtyOnHandAfter: number;
  productName: string;
  createdByName: string;
  createdAt: string;
}

interface LocationDetailClientProps {
  data: any;
}

const MOVEMENT_TYPE_STYLES: Record<string, string> = {
  PURCHASE_IN: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  SALE_OUT: "border-transparent bg-red-500/10 text-red-700 dark:text-red-400",
  TRANSFER_IN: "border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400",
  TRANSFER_OUT: "border-transparent bg-orange-500/10 text-orange-700 dark:text-orange-400",
  ADJUSTMENT_IN: "border-transparent bg-purple-500/10 text-purple-700 dark:text-purple-400",
  ADJUSTMENT_OUT: "border-transparent bg-rose-500/10 text-rose-700 dark:text-rose-400",
  RETURN_IN: "border-transparent bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  RETURN_OUT: "border-transparent bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  INITIAL: "border-transparent bg-slate-500/10 text-slate-700 dark:text-slate-400",
};

export function LocationDetailClient({ data }: LocationDetailClientProps) {
  const router = useRouter();
  const [productSearch, setProductSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const { location, balances, recentLedger } = data;
  const typedBalances = balances as BalanceItem[];
  const typedLedger = recentLedger as LedgerEntry[];

  const filteredBalances = useMemo(() => {
    if (!productSearch) return typedBalances;
    const q = productSearch.toLowerCase();
    return typedBalances.filter(
      (b) => b.productName.toLowerCase().includes(q) || (b.sku || "").toLowerCase().includes(q),
    );
  }, [typedBalances, productSearch]);

  const summaryTotals = useMemo(() => {
    return {
      totalSku: typedBalances.length,
      totalQty: typedBalances.reduce((s, b) => s + b.qtyOnHand, 0),
      totalValue: typedBalances.reduce((s, b) => s + b.stockValue, 0),
      totalReserved: typedBalances.reduce((s, b) => s + b.qtyReserved, 0),
      totalAvailable: typedBalances.reduce((s, b) => s + b.qtyAvailable, 0),
    };
  }, [typedBalances]);

  function handleUpdated() {
    setEditOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={location.name}
        description={`${location.code} · ${location.type.replace(/_/g, " ")}`}
      >
        <Button variant="ghost" size="sm" onClick={() => router.push("/inventory/locations")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> All Locations
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Edit className="mr-2 h-4 w-4" /> Edit
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="h-4 w-4" />
            Total SKUs
          </div>
          <p className="mt-1 text-2xl font-semibold">{summaryTotals.totalSku}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShoppingCart className="h-4 w-4" />
            Total Quantity
          </div>
          <p className="mt-1 text-2xl font-semibold">{summaryTotals.totalQty}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {summaryTotals.totalReserved} reserved · {summaryTotals.totalAvailable} available
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Stock Value
          </div>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(summaryTotals.totalValue)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-4 w-4" />
            Status
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`flex h-2.5 w-2.5 rounded-full ${location.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className="text-sm font-medium">{location.isActive ? "Active" : "Inactive"}</span>
            {location.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
            {location.isSellable && <Badge variant="success" className="text-[10px]">Sellable</Badge>}
          </div>
        </Card>
      </div>

      {/* Location Info */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium">Location Information</h3>
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <Badge className={`mt-0.5 ${TYPE_BADGE_STYLES[location.type] || ""}`}>
              {location.type.replace(/_/g, " ")}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Branch</p>
            <p className="mt-0.5 font-medium">{location.branch?.name || <span className="text-muted-foreground/60">—</span>}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Assigned Employee</p>
            <p className="mt-0.5 font-medium">
              {location.assignedEmployee ? (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {location.assignedEmployee.name}
                </span>
              ) : (
                <span className="text-muted-foreground/60">—</span>
              )}
            </p>
          </div>
          {location.address && (
            <div className="sm:col-span-2 lg:col-span-1">
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="mt-0.5 font-medium">{location.address}</p>
            </div>
          )}
          {location.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="mt-0.5 text-muted-foreground">{location.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs: Stock / Movement History */}
      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">
            <Package className="mr-1.5 h-4 w-4" />
            Stock ({typedBalances.length})
          </TabsTrigger>
          <TabsTrigger value="movements">
            <History className="mr-1.5 h-4 w-4" />
            Movement History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card className="p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by product name or SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Showing {filteredBalances.length} of {typedBalances.length}
              </p>
            </div>

            {filteredBalances.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Package className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  {typedBalances.length === 0 ? "No stock at this location" : "No products match your search"}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile stock cards */}
                <div className="block sm:hidden">
                  <div className="space-y-2">
                    {filteredBalances.map((b) => (
                      <div key={b.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{b.productName}</p>
                            <p className="text-xs text-muted-foreground">{b.sku || b.barcode || "—"}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{b.unit || "unit"}</Badge>
                        </div>
                        <Separator className="my-2" />
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div>
                            <p className="text-muted-foreground">On Hand</p>
                            <p className="font-medium">{b.qtyOnHand}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Reserved</p>
                            <p className="font-medium">{b.qtyReserved}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Available</p>
                            <p className="font-medium">{b.qtyAvailable}</p>
                          </div>
                        </div>
                        <div className="mt-2 text-right text-xs text-muted-foreground">
                          Value: {formatCurrency(b.stockValue)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop stock table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU / Barcode</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">On Hand</TableHead>
                        <TableHead className="text-right">Reserved</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right">Avg Cost</TableHead>
                        <TableHead className="text-right">Stock Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBalances.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div>
                                <p className="truncate max-w-[200px]">{b.productName}</p>
                                {b.unit && <p className="text-[10px] text-muted-foreground">{b.unit}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <code className="rounded bg-muted px-1 py-0.5 font-mono">{b.sku || b.barcode || "—"}</code>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {b.categoryName || <span className="text-muted-foreground/60">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-medium">{b.qtyOnHand}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{b.qtyReserved}</TableCell>
                          <TableCell className="text-right font-medium">{b.qtyAvailable}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {formatCurrency(b.averageCost)}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(b.stockValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card className="p-4">
            {typedLedger.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <History className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">No recent movements</p>
              </div>
            ) : (
              <>
                {/* Mobile movement cards */}
                <div className="block sm:hidden">
                  <div className="space-y-2">
                    {typedLedger.map((e) => (
                      <div key={e.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{e.productName}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
                          </div>
                          <Badge className={MOVEMENT_TYPE_STYLES[e.movementType] || ""}>
                            {e.movementType.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Qty: <span className="font-medium text-foreground">{e.quantity}</span>
                          </span>
                          <span className="text-muted-foreground">
                            By: {e.createdByName}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop movement table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Before</TableHead>
                        <TableHead className="text-right">After</TableHead>
                        <TableHead>Created By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typedLedger.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(e.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge className={MOVEMENT_TYPE_STYLES[e.movementType] || ""}>
                              {e.movementType.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{e.productName}</TableCell>
                          <TableCell className="text-right font-medium">{e.quantity}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{e.qtyOnHandBefore}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{e.qtyOnHandAfter}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{e.createdByName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <LocationCreateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={handleUpdated}
        editData={location}
      />
    </div>
  );
}
