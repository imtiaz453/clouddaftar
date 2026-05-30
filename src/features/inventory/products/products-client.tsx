"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useCallback } from "react";
import {
  Search, Plus, ArrowUpDown, Eye, Pencil, Trash2,
  Package, MapPin,
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
import { getProducts, deleteProduct } from "@/actions/inventory";
import { toast } from "sonner";
import { ProductFormDialog } from "./product-form-dialog";
import type { PaginatedResponse } from "@/types";

interface StockLocation {
  id: string;
  name: string;
  qtyOnHand: number;
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
  const [data, setData] = useState<PaginatedResponse<ProductRow> | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  return (
    <div className="space-y-5">
      <PageHeader title="Products" description="Manage your product catalog and stock levels">
        <Button size="sm" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> New Product
        </Button>
      </PageHeader>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={categoryId} onValueChange={(v) => handleFilterChange("categoryId", v)}>
              <SelectTrigger className="h-9 w-[150px]">
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
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={locationId} onValueChange={(v) => handleFilterChange("locationId", v)}>
              <SelectTrigger className="h-9 w-[160px]">
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
          <div className="mt-2 text-xs text-muted-foreground">
            {total} product{total !== 1 ? "s" : ""} &middot; Stock value: {formatCurrency(totalStockValue)}
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
          <div className="grid gap-3 sm:hidden">
            {products.map((product) => {
              const isLowStock = product.stockSummary.totalOnHand > 0 && product.stockSummary.totalOnHand <= product.minStock;
              const isOutOfStock = product.stockSummary.totalOnHand === 0 && !product.isService;
              return (
                <Card key={product.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/inventory/products/${product.id}`}
                          className="truncate font-medium hover:underline"
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
                        { label: "View Detail", icon: Eye, onSelect: () => router.push(`/inventory/products/${product.id}`) },
                        { label: "Edit", icon: Pencil, onSelect: () => handleEdit(product) },
                        { label: "Adjust Stock", icon: Package, onSelect: () => router.push(`/inventory/products/${product.id}/adjust`) },
                        { label: "Opening Balance", icon: MapPin, onSelect: () => router.push(`/inventory/products/${product.id}/opening-balance`) },
                        { label: "Transfer", icon: ArrowUpDown, onSelect: () => router.push(`/inventory/products/${product.id}/transfer`) },
                        { label: "Delete", icon: Trash2, onSelect: () => handleDelete(product.id), destructive: true, separatorBefore: true },
                      ]}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className={cn(isOutOfStock ? "text-red-600 font-medium" : isLowStock ? "text-amber-600 font-medium" : "")}>
                      On Hand: {product.stockSummary.totalOnHand} {product.unit}
                    </span>
                    <span className="text-muted-foreground">Available: {product.stockSummary.totalAvailable}</span>
                    <span>Price: {formatCurrency(product.sellingPrice)}</span>
                    {product.category && (
                      <Badge variant="secondary" className="text-[10px]">{product.category.name}</Badge>
                    )}
                  </div>
                  {product.stockSummary.locations.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {product.stockSummary.locations.map((loc) => (
                        <span
                          key={loc.id}
                          className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums"
                        >
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="max-w-[60px] truncate text-muted-foreground">{loc.name}:</span>
                          <span className="font-medium">{loc.qtyOnHand}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                  <TableHead className="text-right">Selling Price</TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const avgCost = product.stockSummary.totalOnHand > 0
                    ? product.stockSummary.stockValue / product.stockSummary.totalOnHand
                    : product.purchasePrice;
                  const isLowStock = product.stockSummary.totalOnHand > 0 && product.stockSummary.totalOnHand <= product.minStock;
                  const isOutOfStock = product.stockSummary.totalOnHand === 0 && !product.isService;
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/inventory/products/${product.id}`}
                              className="truncate font-medium hover:underline"
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
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell>
                        {product.trackingMode !== "NONE" ? (
                          <Badge variant="outline" className="text-[10px]">
                            {product.trackingMode}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">---</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={cn(isOutOfStock ? "text-red-600 font-medium" : isLowStock ? "text-amber-600 font-medium" : "font-medium")}>
                            {product.stockSummary.totalOnHand}
                          </span>
                          <span className="text-xs text-muted-foreground">{product.unit}</span>
                          {isOutOfStock ? (
                            <Badge variant="destructive" className="text-[10px]">Out</Badge>
                          ) : isLowStock ? (
                            <Badge variant="warning" className="text-[10px]">Low</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{product.stockSummary.totalAvailable}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{product.stockSummary.totalReserved}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(avgCost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(product.stockSummary.stockValue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(product.sellingPrice)}</TableCell>
                      <TableCell>
                        <ActionsMenu
                          compact
                          items={[
                            { label: "View Detail", icon: Eye, onSelect: () => router.push(`/inventory/products/${product.id}`) },
                            { label: "Edit", icon: Pencil, onSelect: () => handleEdit(product) },
                            { label: "Adjust Stock", icon: Package, onSelect: () => router.push(`/inventory/products/${product.id}/adjust`) },
                            { label: "Opening Balance", icon: MapPin, onSelect: () => router.push(`/inventory/products/${product.id}/opening-balance`) },
                            { label: "Transfer", icon: ArrowUpDown, onSelect: () => router.push(`/inventory/products/${product.id}/transfer`) },
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
