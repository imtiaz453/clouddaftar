"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Plus, Package, Edit, Trash2, History, AlertTriangle, Download, Search } from "lucide-react";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ActionsMenu } from "@/components/shared/actions-menu";
import { useToast } from "@/providers/toast-provider";
import { formatCurrency } from "@/lib/utils";
import { dashboardHref } from "@/lib/dashboard-href";
import type { PaginatedResponse } from "@/types";

interface StockByLocation {
  locationId: string;
  locationName: string;
  qtyOnHand: number;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  image: string | null;
  stock: number;
  minStock: number;
  sellingPrice: number;
  purchasePrice: number;
  isActive: boolean;
  category?: { name: string } | null;
  stockByLocation?: StockByLocation[];
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

interface Filters {
  search: string;
  categoryId: string;
  stockStatus: string;
  locationId: string;
  isActive: string;
}

interface ProductsClientProps {
  initialData: PaginatedResponse<ProductRow>;
  categories: CategoryOption[];
  locations: LocationOption[];
}

export function ProductsClient({ initialData, categories, locations }: ProductsClientProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { addToast } = useToast();

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    categoryId: "",
    stockStatus: "",
    locationId: "",
    isActive: "all",
  });
  const [page, setPage] = useState(1);

  const fetchProducts = useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.search) params.set("search", f.search);
      if (f.categoryId) params.set("categoryId", f.categoryId);
      if (f.stockStatus && f.stockStatus !== "all") params.set("stockStatus", f.stockStatus);
      if (f.locationId) params.set("locationId", f.locationId);
      if (f.isActive === "active") params.set("isActive", "true");
      else if (f.isActive === "inactive") params.set("isActive", "false");
      params.set("page", String(p));
      params.set("pageSize", "50");

      const res = await fetch(`/api/inventory?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      addToast({ title: "Failed to load products", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  function handleSearch(value: string) {
    const f = { ...filters, search: value };
    setFilters(f);
    setPage(1);
    fetchProducts(f, 1);
  }

  function handleFilterChange(key: keyof Filters, value: string) {
    const f = { ...filters, [key]: value };
    setFilters(f);
    setPage(1);
    fetchProducts(f, 1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchProducts(filters, newPage);
  }

  async function handleDelete(productId: string) {
    if (!confirm("Delete this product? This action can be undone.")) return;
    try {
      const res = await fetch("/api/inventory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      addToast({ title: "Product deleted", variant: "success" });
      fetchProducts(filters, page);
      router.refresh();
    } catch {
      addToast({ title: "Error deleting product", variant: "error" });
    }
  }

  function productActions(product: ProductRow) {
    const href = dashboardHref(pathname, `/inventory/products/${product.id}`);
    return [
      { label: "View details", icon: Package, onSelect: () => router.push(href) },
      { label: "Edit product", icon: Edit, onSelect: () => router.push(`${href}?edit=true`) },
      { label: "Stock log", icon: History, onSelect: () => router.push(`${href}?tab=ledger`) },
      {
        label: "Delete product",
        icon: Trash2,
        onSelect: () => handleDelete(product.id),
        destructive: true,
        separatorBefore: true,
      },
    ];
  }

  const totalValue = data.data.reduce((sum, p) => sum + Number(p.purchasePrice) * p.stock, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Products" description="Manage your product catalog and stock levels">
        <Button size="sm" onClick={() => router.push(dashboardHref(pathname, "/inventory/products/new"))}>
          <Plus className="mr-2 h-4 w-4" /> New Product
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const columns: ExportColumn[] = [
              { key: "name", label: "Product Name" },
              { key: "sku", label: "SKU" },
              { key: "category", label: "Category" },
              { key: "stock", label: "Stock" },
              { key: "purchasePrice", label: "Purchase Price" },
              { key: "sellingPrice", label: "Selling Price" },
            ];
            const rows = data.data.map((p) => ({
              name: p.name,
              sku: p.sku || "",
              category: p.category?.name || "",
              stock: p.stock,
              purchasePrice: Number(p.purchasePrice),
              sellingPrice: Number(p.sellingPrice),
            }));
            exportToCSV(rows, columns, `products-${Date.now()}`);
          }}
        >
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filters.categoryId} onValueChange={(v) => handleFilterChange("categoryId", v)}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.stockStatus} onValueChange={(v) => handleFilterChange("stockStatus", v)}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.locationId} onValueChange={(v) => handleFilterChange("locationId", v)}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.isActive} onValueChange={(v) => handleFilterChange("isActive", v)}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {data.total} product{data.total !== 1 ? "s" : ""} &middot; Stock value: {formatCurrency(totalValue)}
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="grid gap-3 sm:hidden">
        {loading ? (
          <TableSkeleton />
        ) : data.data.length === 0 ? (
          <EmptyState icon={Package} title="No products found" description="Try adjusting your filters" />
        ) : (
          data.data.map((product) => {
            const isLowStock = product.stock <= product.minStock;
            return (
              <div key={product.id} className="rounded-lg border p-3">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={dashboardHref(pathname, `/inventory/products/${product.id}`)}
                        className="truncate font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <ActionsMenu compact items={productActions(product)} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span>
                    Stock:{" "}
                    <strong className={isLowStock ? "text-red-600" : ""}>
                      {product.stock}
                    </strong>
                  </span>
                  <span>Price: {formatCurrency(Number(product.sellingPrice))}</span>
                  {product.category && (
                    <Badge variant="secondary" className="text-xs">
                      {product.category.name}
                    </Badge>
                  )}
                </div>
                {product.stockByLocation && product.stockByLocation.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {product.stockByLocation.map((sbl) => (
                      <span
                        key={sbl.locationId}
                        className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums"
                      >
                        <span className="max-w-[60px] truncate text-muted-foreground">{sbl.locationName}:</span>
                        <span className={sbl.qtyOnHand <= 0 ? "text-red-600 font-medium" : "font-medium"}>
                          {sbl.qtyOnHand}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <Card>
          {loading ? (
            <div className="p-4">
              <TableSkeleton />
            </div>
          ) : data.data.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Package} title="No products found" description="Try adjusting your filters" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Stock by Location</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((product) => {
                  const stockValue = Number(product.purchasePrice) * product.stock;
                  const isLowStock = product.stock <= product.minStock;
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
                              href={dashboardHref(pathname, `/inventory/products/${product.id}`)}
                              className="truncate font-medium hover:underline"
                            >
                              {product.name}
                            </Link>
                            {product.barcode && (
                              <p className="truncate text-xs text-muted-foreground">{product.barcode}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell>
                        {product.category && <Badge variant="secondary">{product.category.name}</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={isLowStock ? "font-medium text-red-600" : "font-medium"}>
                            {product.stock}
                          </span>
                          {product.stock === 0 ? (
                            <Badge variant="destructive" className="text-[10px]">Out</Badge>
                          ) : isLowStock ? (
                            <Badge variant="warning" className="text-[10px]">Low</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.stockByLocation && product.stockByLocation.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {product.stockByLocation.map((sbl) => (
                              <span
                                key={sbl.locationId}
                                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums"
                                title={sbl.locationName}
                              >
                                <span className="max-w-[60px] truncate text-muted-foreground">{sbl.locationName}:</span>
                                <span className={sbl.qtyOnHand <= 0 ? "text-red-600 font-medium" : "font-medium"}>
                                  {sbl.qtyOnHand}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(Number(product.sellingPrice))}</TableCell>
                      <TableCell className="text-muted-foreground">{formatCurrency(stockValue)}</TableCell>
                      <TableCell>
                        <ActionsMenu items={productActions(product)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => handlePageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.totalPages}
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
      )}
    </div>
  );
}
