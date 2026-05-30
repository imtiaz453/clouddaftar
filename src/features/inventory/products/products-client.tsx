"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useCallback } from "react";
import {
  Search, Plus, ArrowUpDown, Eye, Pencil, Trash2,
  Package, MapPin, Upload, ShieldCheck, AlertTriangle,
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
import { formatCurrency, cn } from "@/lib/utils";
import { dashboardHref } from "@/lib/dashboard-href";
import { getProducts, deleteProduct } from "@/actions/inventory";
import { toast } from "sonner";
import { ProductFormDialog } from "./product-form-dialog";
import { ImportDialog } from "@/components/shared/import/import-dialog";
import type { PaginatedResponse } from "@/types";

interface StockLocation {
  id: string;
  name: string;
  code: string | null;
  type: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  image: string | null;
  unit: string;
  category: { name: string } | null;
  minStock: number;
  maxStock: number | null;
  isService: boolean;
  isActive: boolean;
  trackingMode: string;
  sellingPrice: number;
  purchasePrice: number;
  stockSummary: {
    totalOnHand: number;
    totalReserved: number;
    totalAvailable: number;
    stockValue: number;
    locations: StockLocation[];
    allLocationTotals?: {
      totalOnHand: number;
      totalReserved: number;
      totalAvailable: number;
      stockValue: number;
    };
    isLocationFiltered?: boolean;
  };
}

interface CategoryOption {
  id: string;
  name: string;
}

interface LocationOption {
  id: string;
  name: string;
  code: string;
}

interface ProductsClientProps {
  initialData?: PaginatedResponse<ProductRow>;
  categories: CategoryOption[];
  locations: LocationOption[];
}

export function ProductsClient({ initialData, categories, locations }: ProductsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const productHref = (productId: string) => dashboardHref(pathname, `/inventory/products/${productId}`);
  const productActionHref = (route: string, productId: string) => dashboardHref(pathname, route, { productId });
  const [data, setData] = useState<PaginatedResponse<ProductRow> | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);

  const fetchProducts = useCallback(async (opts: {
    search?: string; categoryId?: string; stockStatus?: string;
    locationId?: string; page?: number;
  }) => {
    setLoading(true);
    try {
      const result = await getProducts({
        search: opts.search || undefined,
        categoryId: opts.categoryId && opts.categoryId !== "all" ? opts.categoryId : undefined,
        stockStatus: (opts.stockStatus && opts.stockStatus !== "all" ? opts.stockStatus : undefined) as "low" | "out" | undefined,
        locationId: opts.locationId && opts.locationId !== "all" ? opts.locationId : undefined,
        page: opts.page || 1,
        pageSize: 50,
      });
      setData(result as unknown as PaginatedResponse<ProductRow>);
    } catch (err) {
      toast.error("Failed to load products", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    fetchProducts({ search: value, categoryId, stockStatus, locationId, page: 1 });
  }

  function handleFilterChange(key: string, value: string) {
    const newCategoryId = key === "categoryId" ? value : categoryId;
    const newStockStatus = key === "stockStatus" ? value : stockStatus;
    const newLocationId = key === "locationId" ? value : locationId;
    setCategoryId(newCategoryId);
    setStockStatus(newStockStatus);
    setLocationId(newLocationId);
    setPage(1);
    fetchProducts({
      search, categoryId: newCategoryId, stockStatus: newStockStatus,
      locationId: newLocationId, page: 1,
    });
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchProducts({ search, categoryId, stockStatus, locationId, page: newPage });
  }

  function handleAdd() {
    setEditProduct(null);
    setDialogOpen(true);
  }

  function handleEdit(product: ProductRow) {
    setEditProduct(product);
    setDialogOpen(true);
  }

  async function handleDelete(productId: string) {
    try {
      await deleteProduct(productId);
      toast.success("Product deleted");
      fetchProducts({ search, categoryId, stockStatus, locationId, page });
      router.refresh();
    } catch (err) {
      toast.error("Error deleting product", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  function onDialogSuccess() {
    setDialogOpen(false);
    setEditProduct(null);
    fetchProducts({ search, categoryId, stockStatus, locationId, page });
    router.refresh();
  }

  const products = data?.data ?? [];
  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;

  const totalStockValue = products.reduce((sum, p) => sum + p.stockSummary.stockValue, 0);
  const activeProducts = products.filter((p) => p.isActive).length;
  const lowStockCount = products.filter((p) => !p.isService && p.stockSummary.totalOnHand > 0 && p.stockSummary.totalOnHand <= p.minStock).length;
  const outOfStockCount = products.filter((p) => !p.isService && p.stockSummary.totalOnHand === 0).length;
  const availableQty = products.reduce((sum, p) => sum + p.stockSummary.totalAvailable, 0);
  const selectedLocation = locationId && locationId !== "all"
    ? locations.find((loc) => loc.id === locationId)
    : null;
  const stockScopeLabel = selectedLocation
    ? `Showing stock in ${selectedLocation.name} only`
    : "Showing total stock across all stores";

  function getStockStatus(product: ProductRow) {
    if (product.isService) return { label: "Service", className: "bg-slate-100 text-slate-700", isLow: false, isOut: false };
    const onHand = product.stockSummary.totalOnHand;
    if (onHand <= 0) return { label: "Out", className: "bg-red-50 text-red-700 border-red-200", isLow: false, isOut: true };
    if (onHand <= product.minStock) return { label: "Low", className: "bg-amber-50 text-amber-700 border-amber-200", isLow: true, isOut: false };
    return { label: "OK", className: "bg-emerald-50 text-emerald-700 border-emerald-200", isLow: false, isOut: false };
  }

  function formatQty(value: number, unit?: string) {
    return `${Number(value || 0).toLocaleString()}${unit ? ` ${unit}` : ""}`;
  }

  function StockPills({ product }: { product: ProductRow }) {
    const status = getStockStatus(product);
    if (product.isService) {
      return (
        <div className="inline-flex items-center rounded-full border bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
          Service item — no stock tracking
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="rounded-full border bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
            On hand: {formatQty(product.stockSummary.totalOnHand, product.unit)}
          </span>
          <span className="rounded-full border bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Available: {formatQty(product.stockSummary.totalAvailable, product.unit)}
          </span>
          {product.stockSummary.totalReserved > 0 && (
            <span className="rounded-full border bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              Reserved: {formatQty(product.stockSummary.totalReserved, product.unit)}
            </span>
          )}
          <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", status.className)}>{status.label}</span>
        </div>
        {selectedLocation && product.stockSummary.allLocationTotals && (
          <p className="text-right text-[11px] text-muted-foreground">
            All stores total: {formatQty(product.stockSummary.allLocationTotals.totalOnHand, product.unit)} on hand · {formatQty(product.stockSummary.allLocationTotals.totalAvailable, product.unit)} available
          </p>
        )}
      </div>
    );
  }

  function LocationBreakdown({ product }: { product: ProductRow }) {
    if (product.isService) return <span className="text-xs text-muted-foreground">Not applicable</span>;
    const visibleLocations = product.stockSummary.locations.filter((loc) => loc.qtyOnHand !== 0 || loc.qtyReserved !== 0 || loc.qtyAvailable !== 0);
    if (visibleLocations.length === 0) {
      return (
        <div className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" /> No stock in selected store
        </div>
      );
    }

    return (
      <div className="flex max-w-[420px] flex-wrap gap-1.5">
        {visibleLocations.slice(0, 4).map((loc) => (
          <div
            key={loc.id}
            title={`${loc.name}: ${loc.qtyOnHand} on hand, ${loc.qtyAvailable} available, ${loc.qtyReserved} reserved`}
            className="inline-flex max-w-[210px] items-center gap-1.5 rounded-xl border bg-white px-2.5 py-1 text-[11px] shadow-sm"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium text-slate-700">{loc.name}</span>
            <span className="shrink-0 tabular-nums text-slate-900">{formatQty(loc.qtyOnHand, product.unit)}</span>
            {loc.qtyAvailable !== loc.qtyOnHand && (
              <span className="shrink-0 text-muted-foreground">/ {formatQty(loc.qtyAvailable)} avail</span>
            )}
          </div>
        ))}
        {visibleLocations.length > 4 && (
          <span className="rounded-xl border bg-slate-50 px-2.5 py-1 text-[11px] text-muted-foreground">
            +{visibleLocations.length - 4} more
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="cd-page">
      <PageHeader title="Products" description="Manage your product catalog and stock levels">
        <Button size="sm" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> New Product
        </Button>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" /> Import Products
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="cd-stat-card">
          <p className="cd-stat-label">Catalog</p>
          <p className="cd-stat-value">{total}</p>
          <p className="mt-1 text-xs text-muted-foreground">{activeProducts} active products loaded</p>
        </div>
        <div className="cd-stat-card">
          <p className="cd-stat-label">Available Qty</p>
          <p className="cd-stat-value tabular-nums">{availableQty}</p>
          <p className="mt-1 text-xs text-muted-foreground">Across the current page filters</p>
        </div>
        <div className="cd-stat-card">
          <p className="cd-stat-label">Stock Value</p>
          <p className="cd-stat-value tabular-nums">{formatCurrency(totalStockValue)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Calculated from on-hand balances</p>
        </div>
        <div className="cd-stat-card">
          <p className="cd-stat-label">Attention</p>
          <p className="cd-stat-value tabular-nums">{lowStockCount + outOfStockCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">{lowStockCount} low · {outOfStockCount} out of stock</p>
        </div>
      </div>

      <Card className="cd-toolbar">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background/80 pl-9 pr-4 text-sm placeholder:text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:flex xl:flex-wrap">
            <Select value={categoryId} onValueChange={(v) => handleFilterChange("categoryId", v)}>
              <SelectTrigger className="h-10 w-full sm:w-full xl:w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.filter((c) => typeof c.id === "string" && c.id.trim() !== "").map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stockStatus} onValueChange={(v) => handleFilterChange("stockStatus", v)}>
              <SelectTrigger className="h-10 w-full sm:w-full xl:w-[150px]">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={locationId} onValueChange={(v) => handleFilterChange("locationId", v)}>
              <SelectTrigger className="h-10 w-full sm:w-full xl:w-[170px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.filter((l) => typeof l.id === "string" && l.id.trim() !== "").map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!loading && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{total} product{total !== 1 ? "s" : ""}</span>
            <span>&middot;</span>
            <span>{stockScopeLabel}</span>
            <span>&middot;</span>
            <span>Visible stock value: {formatCurrency(totalStockValue)}</span>
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
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description="Try adjusting your filters or create a new product"
          action={
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" /> New Product
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {products.map((product) => {
              const isLowStock = product.stockSummary.totalOnHand > 0 && product.stockSummary.totalOnHand <= product.minStock;
              const isOutOfStock = product.stockSummary.totalOnHand === 0 && !product.isService;
              return (
                <Card key={product.id} className="cd-mobile-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={productHref(product.id)}
                          className="block max-w-[320px] truncate font-medium hover:text-primary hover:underline"
                        >
                          {product.name}
                        </Link>
                        {isOutOfStock ? (
                          <Badge variant="destructive" className="shrink-0 text-[10px]">Out</Badge>
                        ) : isLowStock ? (
                          <Badge variant="warning" className="shrink-0 text-[10px]">Low</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <ActionsMenu
                      compact
                      items={[
                        { label: "View Detail", icon: Eye, onSelect: () => router.push(productHref(product.id)) },
                        { label: "Edit", icon: Pencil, onSelect: () => handleEdit(product) },
                        { label: "Adjust Stock", icon: Package, onSelect: () => router.push(productActionHref("/inventory/adjustments", product.id)) },
                        { label: "Opening Balance", icon: MapPin, onSelect: () => router.push(productActionHref("/inventory/adjustments", product.id)) },
                        { label: "Transfer", icon: ArrowUpDown, onSelect: () => router.push(productActionHref("/inventory/transfers", product.id)) },
                        { label: "Delete", icon: Trash2, onSelect: () => handleDelete(product.id), destructive: true, separatorBefore: true },
                      ]}
                    />
                  </div>
                  <div className="mt-3 rounded-2xl border bg-slate-50/80 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stock</span>
                      <span className="text-[11px] text-muted-foreground">{selectedLocation ? selectedLocation.name : "All stores"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full border bg-white px-2.5 py-1 font-semibold">On hand: {formatQty(product.stockSummary.totalOnHand, product.unit)}</span>
                      <span className="rounded-full border bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Available: {formatQty(product.stockSummary.totalAvailable, product.unit)}</span>
                      {product.stockSummary.totalReserved > 0 && (
                        <span className="rounded-full border bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">Reserved: {formatQty(product.stockSummary.totalReserved, product.unit)}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span>Price: {formatCurrency(product.sellingPrice)}</span>
                    {product.category && (
                      <Badge variant="secondary" className="text-[10px]">{product.category.name}</Badge>
                    )}
                  </div>
                  <div className="mt-2">
                    <LocationBreakdown product={product} />
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="hidden lg:block">
            <div className="mb-3 rounded-2xl border bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span className="font-semibold">Stock view:</span>
                <span>{stockScopeLabel}. On hand means physical quantity. Available means sellable/transferable quantity after reservations.</span>
              </div>
            </div>
            <Table className="min-w-[1180px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU / Tracking</TableHead>
                  <TableHead className="text-right">Stock Balance</TableHead>
                  <TableHead>Store Breakdown</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Selling Price</TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const avgCost = product.stockSummary.totalOnHand > 0
                    ? product.stockSummary.stockValue / product.stockSummary.totalOnHand
                    : product.purchasePrice;
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex min-w-[240px] items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={productHref(product.id)}
                              className="block max-w-[320px] truncate font-medium hover:text-primary hover:underline"
                            >
                              {product.name}
                            </Link>
                            <div className="flex items-center gap-1.5">
                              {product.barcode && (
                                <span className="truncate text-xs text-muted-foreground">{product.barcode}</span>
                              )}
                              {product.category && (
                                <Badge variant="secondary" className="text-[10px]">{product.category.name}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-mono text-xs">{product.sku}</div>
                          {product.trackingMode !== "NONE" ? (
                            <Badge variant="outline" className="text-[10px]">
                              {product.trackingMode}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">No batch/serial tracking</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <StockPills product={product} />
                      </TableCell>
                      <TableCell>
                        <LocationBreakdown product={product} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-1 tabular-nums">
                          <div className="font-medium">{formatCurrency(product.stockSummary.stockValue)}</div>
                          <div className="text-xs text-muted-foreground">Avg cost {formatCurrency(avgCost)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(product.sellingPrice)}</TableCell>
                      <TableCell>
                        <ActionsMenu
                          compact
                          items={[
                            { label: "View Detail", icon: Eye, onSelect: () => router.push(productHref(product.id)) },
                            { label: "Edit", icon: Pencil, onSelect: () => handleEdit(product) },
                            { label: "Adjust Stock", icon: Package, onSelect: () => router.push(productActionHref("/inventory/adjustments", product.id)) },
                            { label: "Opening Balance", icon: MapPin, onSelect: () => router.push(productActionHref("/inventory/adjustments", product.id)) },
                            { label: "Transfer", icon: ArrowUpDown, onSelect: () => router.push(productActionHref("/inventory/transfers", product.id)) },
                            { label: "Delete", icon: Trash2, onSelect: () => handleDelete(product.id), destructive: true, separatorBefore: true },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        type="products"
        title="Import Products"
        description="Upload an Excel or CSV file to bulk import products"
      />

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editProduct as any}
        categories={categories}
        onSuccess={onDialogSuccess}
      />
    </div>
  );
}
