"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Package,
  Edit,
  Trash2,
  History,
  AlertTriangle,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Truck,
  Warehouse,
  Boxes,
  LineChart,
  RefreshCw,
  ArrowRightLeft,
} from "lucide-react";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { dashboardHref } from "@/lib/dashboard-href";
import { useToast } from "@/providers/toast-provider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PaginatedResponse } from "@/types";
import type { Product, Category } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProductDialog } from "./product-dialog";
import { ImportDialog } from "@/components/shared/import/import-dialog";
import { ActionsMenu } from "@/components/shared/actions-menu";
import { type DataViewMode, ViewSwitcher } from "@/components/shared/view-switcher";

interface InventoryClientProps {
  products: PaginatedResponse<Product & { category?: { name: string } | null }>;
  categories: Category[];
  overview: any;
}

export function InventoryClient({
  products: initialProducts,
  categories,
  overview,
}: InventoryClientProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const { addToast } = useToast();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultProductName, setDefaultProductName] = useState("");
  const [editProduct, setEditProduct] = useState<
    (Product & { category?: { name: string } | null }) | null
  >(null);
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [stockDialog, setStockDialog] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });
  const [stockForm, setStockForm] = useState({ quantity: 0, type: "ADJUSTMENT", notes: "" });
  const [stockAdjusting, setStockAdjusting] = useState(false);
  const [viewMode, setViewMode] = useState<DataViewMode>("list");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferForm, setTransferForm] = useState({
    productId: "",
    fromWarehouseId: "",
    toWarehouseId: "",
    quantity: 1,
    notes: "",
  });
  const [lotOpen, setLotOpen] = useState(false);
  const [lotSaving, setLotSaving] = useState(false);
  const [lotForm, setLotForm] = useState({
    productId: "",
    warehouseId: "",
    lotNumber: "",
    serialNumber: "",
    quantity: 1,
    expiryDate: "",
    notes: "",
  });

  const [logDialog, setLogDialog] = useState<{
    open: boolean;
    productId: string;
    productName: string;
    logs: any[];
  }>({ open: false, productId: "", productName: "", logs: [] });
  const [logLoading, setLogLoading] = useState(false);
  const transferPolicy = overview.transferPolicy || {
    canChooseSource: true,
    defaultFromWarehouseId: "",
    sourceWarehouseIds: overview.warehouses.map((warehouse: any) => warehouse.id),
  };
  const sourceWarehouses = transferPolicy.canChooseSource
    ? overview.warehouses
    : overview.warehouses.filter((warehouse: any) =>
        transferPolicy.sourceWarehouseIds.includes(warehouse.id),
      );
  const destinationWarehouses = overview.warehouses.filter(
    (warehouse: any) => warehouse.id !== transferForm.fromWarehouseId,
  );

  useEffect(() => {
    setProducts(initialProducts);
    setPage(1);
  }, [initialProducts]);

  useEffect(() => {
    const createProduct = searchParams.get("createProduct");
    if (!createProduct) return;
    setEditProduct(null);
    setDefaultProductName(createProduct);
    setDialogOpen(true);
  }, [searchParams]);

  async function loadPage(newPage: number) {
    setPage(newPage);
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory?search=${encodeURIComponent(search)}&page=${newPage}&pageSize=50`);
      const data = await res.json();
      if (data.success) setProducts(data.data);
      else addToast({ title: "Failed to load products", variant: "error" });
    } catch {
      addToast({ title: "Failed to load products", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory?search=${encodeURIComponent(value)}&page=1&pageSize=50`);
      const data = await res.json();
      if (data.success) setProducts(data.data);
      else addToast({ title: "Failed to search products", variant: "error" });
    } catch {
      addToast({ title: "Failed to search products", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(product: Product & { category?: { name: string } | null }) {
    setEditProduct(product);
    setDialogOpen(true);
  }

  function handleAdd() {
    setEditProduct(null);
    setDefaultProductName("");
    setDialogOpen(true);
  }

  function openTransferDialog() {
    setTransferForm((prev) => ({
      ...prev,
      fromWarehouseId: prev.fromWarehouseId || transferPolicy.defaultFromWarehouseId || "",
      toWarehouseId:
        prev.toWarehouseId && prev.toWarehouseId !== transferPolicy.defaultFromWarehouseId
          ? prev.toWarehouseId
          : "",
    }));
    setTransferOpen(true);
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
      router.refresh();
    } catch {
      addToast({ title: "Error deleting product", variant: "error" });
    }
  }

  async function openStockLog(product: Product) {
    setLogDialog({ open: true, productId: product.id, productName: product.name, logs: [] });
    setLogLoading(true);
    try {
      const res = await fetch(`/api/inventory/logs?productId=${product.id}`);
      const data = await res.json();
      if (data.success) {
        setLogDialog((prev) => ({ ...prev, logs: data.data }));
      }
    } catch {
      // ignore
    } finally {
      setLogLoading(false);
    }
  }

  async function handleStockAdjust(e: React.FormEvent) {
    e.preventDefault();
    setStockAdjusting(true);
    try {
      const res = await fetch("/api/inventory/adjust-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: stockDialog.product?.id, ...stockForm }),
      });
      if (!res.ok) throw new Error("Failed to adjust stock");
      addToast({ title: "Stock adjusted", variant: "success" });
      setStockDialog({ open: false, product: null });
      setStockForm({ quantity: 0, type: "ADJUSTMENT", notes: "" });
      router.refresh();
    } catch {
      addToast({ title: "Error adjusting stock", variant: "error" });
    } finally {
      setStockAdjusting(false);
    }
  }

  async function handleCreateLot(e: React.FormEvent) {
    e.preventDefault();
    setLotSaving(true);
    try {
      const res = await fetch("/api/inventory/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lotForm),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Failed to create traceability record");
      }
      addToast({ title: "Traceability record created", variant: "success" });
      setLotOpen(false);
      setLotForm({
        productId: "",
        warehouseId: "",
        lotNumber: "",
        serialNumber: "",
        quantity: 1,
        expiryDate: "",
        notes: "",
      });
      router.refresh();
    } catch (error) {
      addToast({
        title: "Could not save lot or serial",
        description: error instanceof Error ? error.message : "Failed to create traceability record",
        variant: "error",
      });
    } finally {
      setLotSaving(false);
    }
  }

  async function handleTransferStock(e: React.FormEvent) {
    e.preventDefault();
    setTransferSaving(true);
    try {
      const res = await fetch("/api/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferForm),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data.success === false) {
        throw new Error(data?.error || "Failed to transfer stock");
      }
      const ref = data.data?.reference;
      addToast({
        title: "Stock transferred",
        description: ref ? `Reference: ${ref}` : undefined,
        variant: "success",
      });
      setTransferOpen(false);
      setTransferForm({
        productId: "",
        fromWarehouseId: "",
        toWarehouseId: "",
        quantity: 1,
        notes: "",
      });
      if (ref) {
        window.open(
          `/api/transfers/${encodeURIComponent(ref)}?print=1`,
          "_blank",
          "width=800,height=700",
        );
      }
      router.refresh();
    } catch (error) {
      addToast({
        title: "Transfer failed",
        description: error instanceof Error ? error.message : "Failed to transfer stock",
        variant: "error",
      });
    } finally {
      setTransferSaving(false);
    }
  }

  function productActions(product: Product & { category?: { name: string } | null }) {
    return [
      { label: "Edit product", icon: Edit, onSelect: () => handleEdit(product) },
      { label: "Stock log", icon: History, onSelect: () => openStockLog(product) },
      {
        label: "Adjust stock",
        icon: Package,
        onSelect: () => setStockDialog({ open: true, product }),
      },
      {
        label: "Delete product",
        icon: Trash2,
        onSelect: () => handleDelete(product.id),
        destructive: true,
        separatorBefore: true,
      },
    ];
  }

  const totalValue = products.data.reduce((sum, p) => sum + Number(p.purchasePrice) * p.stock, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        description="Products, replenishment, warehouses, traceability, valuation, and stock movements"
      >
        <Button size="sm" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> New Product
        </Button>
        <ActionsMenu
          items={[
            { label: "Transfer Stock", icon: ArrowRightLeft, onSelect: openTransferDialog },
            { label: "Import Products", icon: Upload, onSelect: () => setImportOpen(true) },
            {
              label: "Export Products",
              icon: Download,
              onSelect: () => {
                const columns: ExportColumn[] = [
                  { key: "name", label: "Product Name" },
                  { key: "sku", label: "SKU" },
                  { key: "category", label: "Category" },
                  { key: "stock", label: "Stock" },
                  { key: "purchasePrice", label: "Purchase Price" },
                  { key: "sellingPrice", label: "Selling Price" },
                ];
                const data = products.data.map((p) => ({
                  name: p.name,
                  sku: p.sku || "",
                  category: (p as any).category?.name || "",
                  stock: p.stock,
                  purchasePrice: Number(p.purchasePrice),
                  sellingPrice: Number(p.sellingPrice),
                }));
                exportToCSV(data, columns, `inventory-export-${Date.now()}`);
              },
            },
          ]}
        />
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Products" value={overview.totals.products} />
        <Metric label="On Hand" value={overview.totals.stockOnHand} />
        <Metric label="Warehouses" value={overview.totals.warehouses} />
        <Metric label="Locations" value={overview.totals.locations} />
        <Metric label="To Replenish" value={overview.totals.lowStock} />
        <Metric label="Valuation" value={formatCurrency(overview.totals.valuation)} />
      </div>

      <Tabs defaultValue="operations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="replenishment">Replenishment</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="traceability">Traceability</TabsTrigger>
          <TabsTrigger value="valuation">Reporting</TabsTrigger>
        </TabsList>

        <TabsContent value="operations">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {overview.operationCards.map((card: any) => (
              <Link
                key={card.label}
                href={dashboardHref(pathname, card.href)}
                className="rounded-md border bg-background p-4 transition hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <OperationIcon label={card.label} />
                  <Badge variant={card.value > 0 ? "warning" : "secondary"}>{card.value}</Badge>
                </div>
                <p className="mt-3 text-sm font-semibold">{card.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.hint}</p>
              </Link>
            ))}
          </div>
          <Card className="mt-4 overflow-hidden">
            <SectionHeader
              title="Moves History"
              description="Recent stock movements across receipts, deliveries, returns, and adjustments."
            />
            <MovesTable moves={overview.recentMoves} />
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card className="p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SearchInput
                placeholder="Search products..."
                value={search}
                onChange={handleSearch}
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>
                    Products: <span className="font-medium text-foreground">{products.total}</span>
                  </span>
                  <span className="text-border">|</span>
                  <span>
                    Stock Value:{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(totalValue)}
                    </span>
                  </span>
                </div>
                <ViewSwitcher value={viewMode} onChange={setViewMode} />
              </div>
            </div>

            {loading ? (
              <TableSkeleton />
            ) : products.data.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products yet"
                description="Add your first product to start managing inventory"
                action={
                  <Button onClick={handleAdd}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                }
              />
            ) : (
              <>
                <div
                  className={
                    viewMode === "kanban"
                      ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                      : "grid gap-3 sm:hidden"
                  }
                >
                  {products.data.map((product) => (
                    <div key={product.id} className="rounded-lg border p-3">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.sku}</p>
                          </div>
                          <ActionsMenu compact items={productActions(product)} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <span>
                            Stock:{" "}
                            <strong
                              className={product.stock <= product.minStock ? "text-red-600" : ""}
                            >
                              {product.stock}
                            </strong>
                          </span>
                          <span>Price: {formatCurrency(Number(product.sellingPrice))}</span>
                          {(product as any).mfgDate && (
                            <span className="text-xs text-muted-foreground">
                              MFG: {formatDate((product as any).mfgDate)}
                            </span>
                          )}
                          {product.expiryDate && (
                            <span className="text-xs text-muted-foreground">
                              EXP: {formatDate(product.expiryDate)}
                              {new Date(product.expiryDate) <
                                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                                <AlertTriangle className="ml-1 inline h-3 w-3 text-amber-500" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={viewMode === "kanban" ? "hidden" : "hidden sm:block"}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>MFG</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.data.map((product) => {
                        const stockValue = Number(product.purchasePrice) * product.stock;
                        const isLowStock = product.stock <= product.minStock;
                        const isExpiring =
                          product.expiryDate &&
                          new Date(product.expiryDate) <
                            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                        return (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                                  {product.image ? (
                                    <img
                                      src={product.image}
                                      alt={product.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{product.name}</p>
                                  {product.barcode && (
                                    <p className="truncate text-xs text-muted-foreground">
                                      {product.barcode}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                            <TableCell>
                              {product.category && (
                                <Badge variant="secondary">{product.category.name}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span
                                  className={
                                    isLowStock ? "font-medium text-red-600" : "font-medium"
                                  }
                                >
                                  {product.stock}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {product.unit}
                                </span>
                                {isLowStock && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Low
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatCurrency(Number(product.sellingPrice))}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatCurrency(stockValue)}
                            </TableCell>
                            <TableCell>
                              {(product as any).mfgDate ? (
                                <span className="text-xs text-muted-foreground">
                                  {formatDate((product as any).mfgDate)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {product.expiryDate ? (
                                <span
                                  className={
                                    isExpiring
                                      ? "text-xs text-amber-600"
                                      : "text-xs text-muted-foreground"
                                  }
                                >
                                  {formatDate(product.expiryDate)}
                                  {isExpiring && <AlertTriangle className="ml-1 inline h-3 w-3" />}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <ActionsMenu compact items={productActions(product)} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {products.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {products.page} of {products.totalPages} ({products.total} total)
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadPage(page - 1)}
                        disabled={page <= 1}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadPage(page + 1)}
                        disabled={page >= products.totalPages}
                      >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="replenishment">
          <Card className="overflow-hidden">
            <SectionHeader
              title="Replenishment Report"
              description="Products at or below minimum quantity, with suggested order quantities to reach maximum stock."
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                    <TableHead className="text-right">To Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.replenishment.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="font-mono text-xs">{row.sku || "-"}</TableCell>
                      <TableCell className="text-right">
                        {row.stock} {row.unit}
                      </TableCell>
                      <TableCell className="text-right">{row.minStock}</TableCell>
                      <TableCell className="text-right">{row.maxStock}</TableCell>
                      <TableCell className="text-right font-medium">{row.toOrder}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="warehouses">
          <Card className="overflow-hidden">
            <SectionHeader
              title="Warehouses and Locations"
              description="Warehouse management with branches, stock locations, on-hand quantities, and active state."
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Locations</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.warehouses.map((warehouse: any) => (
                    <TableRow key={warehouse.id}>
                      <TableCell>
                        <p className="font-medium">{warehouse.name}</p>
                        <p className="text-xs text-muted-foreground">{warehouse.code}</p>
                      </TableCell>
                      <TableCell>{warehouse.branch?.name || "Company level"}</TableCell>
                      <TableCell className="text-right">{warehouse.locations}</TableCell>
                      <TableCell className="text-right">{warehouse.products}</TableCell>
                      <TableCell className="text-right font-medium">{warehouse.onHand}</TableCell>
                      <TableCell>
                        <Badge variant={warehouse.isActive ? "success" : "secondary"}>
                          {warehouse.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="traceability">
          <div className="grid gap-4 lg:grid-cols-3">
            <ReportCard
              label="Barcode Products"
              value={overview.traceability.withBarcode}
              detail="Products ready for barcode operations"
            />
            <ReportCard
              label="Expiring Soon"
              value={overview.traceability.expiringSoon}
              detail="Products expiring within 30 days"
            />
            <ReportCard
              label="Tracked Candidates"
              value={overview.traceability.trackedCandidates}
              detail="Products with barcode, lot, serial, or expiration signals"
            />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
            <Card className="overflow-hidden">
              <SectionHeader
                title="Lots / Serial Numbers"
                description="Trace stock by lot, batch, serial number, warehouse, expiry, and movement history."
              />
              {overview.lots?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Lot / Serial</TableHead>
                      <TableHead>Warehouse Stock</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.lots.map((lot: any) => (
                      <TableRow key={lot.id}>
                        <TableCell>
                          <p className="font-medium">{lot.product?.name}</p>
                          <p className="text-xs text-muted-foreground">{lot.product?.sku || ""}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs">{lot.serialNumber || lot.lotNumber}</p>
                          <Badge variant={lot.serialNumber ? "default" : "secondary"} className="mt-1">
                            {lot.serialNumber ? "Serial" : "Lot"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lot.warehouses
                            .map((warehouse: any) => `${warehouse.code}: ${warehouse.quantity}`)
                            .join(", ") || "No warehouse stock"}
                        </TableCell>
                        <TableCell>
                          {lot.expiryDate ? (
                            <span className="text-sm">{formatDate(lot.expiryDate)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not set</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{lot.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No lots or serial numbers registered yet.
                </div>
              )}
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold">Traceability Controls</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Register received batches or individual serial numbers against a warehouse.
              </p>
              <Button className="mt-4 w-full" onClick={() => setLotOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Lot / Serial
              </Button>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <SmallMetric label="Lots" value={overview.traceability.lots || 0} />
                <SmallMetric label="Serials" value={overview.traceability.serials || 0} />
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="valuation">
          <div className="grid gap-4 lg:grid-cols-3">
            <ReportCard
              label="Inventory Value"
              value={formatCurrency(overview.valuation.cost)}
              detail="On hand at purchase cost"
            />
            <ReportCard
              label="Sales Value"
              value={formatCurrency(overview.valuation.saleValue)}
              detail="On hand at sales price"
            />
            <ReportCard
              label="Margin Potential"
              value={formatCurrency(overview.valuation.marginPotential)}
              detail="Sales value minus cost"
            />
          </div>
          <Card className="mt-4 overflow-hidden">
            <SectionHeader
              title="Inventory Dashboard"
              description="Stockable products, categories, low stock, expiration risk, and movement trace."
            />
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <SmallMetric label="Stockable Products" value={overview.totals.stockableProducts} />
              <SmallMetric label="Categories" value={overview.totals.categories} />
              <SmallMetric label="Low Stock" value={overview.totals.lowStock} />
              <SmallMetric label="Expiring Soon" value={overview.totals.expiringSoon} />
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editProduct}
        categories={categories}
        defaultName={defaultProductName}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        type="products"
        title="Import Products"
        description="Upload an Excel file to bulk import products into your inventory"
      />

      <Dialog open={lotOpen} onOpenChange={setLotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Lot / Serial</DialogTitle>
            <DialogDescription>
              Register traceable stock against a product and warehouse.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLot} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Product</label>
              <select
                value={lotForm.productId}
                onChange={(e) => setLotForm({ ...lotForm, productId: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm"
                required
              >
                <option value="">Select product</option>
                {products.data
                  .filter((product) => !product.isService)
                  .map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} {product.sku ? `(${product.sku})` : ""}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Warehouse</label>
              <select
                value={lotForm.warehouseId}
                onChange={(e) => setLotForm({ ...lotForm, warehouseId: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm"
                required
              >
                <option value="">Select warehouse</option>
                {overview.warehouses.map((warehouse: any) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Lot / Batch Number"
                value={lotForm.lotNumber}
                onChange={(e) => setLotForm({ ...lotForm, lotNumber: e.target.value })}
                required
              />
              <Input
                label="Serial Number"
                value={lotForm.serialNumber}
                onChange={(e) =>
                  setLotForm({
                    ...lotForm,
                    serialNumber: e.target.value,
                    quantity: e.target.value ? 1 : lotForm.quantity,
                  })
                }
                placeholder="Optional for serialized items"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Quantity"
                type="number"
                min="1"
                value={lotForm.quantity || ""}
                onChange={(e) =>
                  setLotForm({ ...lotForm, quantity: parseInt(e.target.value) || 1 })
                }
                disabled={Boolean(lotForm.serialNumber)}
                required
              />
              <Input
                label="Expiry Date"
                type="date"
                value={lotForm.expiryDate}
                onChange={(e) => setLotForm({ ...lotForm, expiryDate: e.target.value })}
              />
            </div>
            <Input
              label="Notes"
              value={lotForm.notes}
              onChange={(e) => setLotForm({ ...lotForm, notes: e.target.value })}
              placeholder="Supplier batch, recall note, or receiving reference"
            />
            <Button type="submit" className="w-full" disabled={lotSaving}>
              {lotSaving ? "Saving..." : "Save Traceability Record"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Stock</DialogTitle>
            <DialogDescription>Move stock from one warehouse to another.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTransferStock} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Product</label>
              <select
                value={transferForm.productId}
                onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm"
                required
              >
                <option value="">Select product</option>
                {products.data
                  .filter((product) => !product.isService)
                  .map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} {product.sku ? `(${product.sku})` : ""}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">From Warehouse</label>
                <select
                  value={transferForm.fromWarehouseId}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      fromWarehouseId: e.target.value,
                      toWarehouseId:
                        transferForm.toWarehouseId === e.target.value
                          ? ""
                          : transferForm.toWarehouseId,
                    })
                  }
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm"
                  disabled={!transferPolicy.canChooseSource}
                  required
                >
                  <option value="">Source</option>
                  {sourceWarehouses.map((warehouse: any) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} - {warehouse.name}
                    </option>
                  ))}
                </select>
                {!transferPolicy.canChooseSource && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    You can transfer out only from your assigned warehouse.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">To Warehouse</label>
                <select
                  value={transferForm.toWarehouseId}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, toWarehouseId: e.target.value })
                  }
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm"
                  required
                >
                  <option value="">Destination</option>
                  {destinationWarehouses.map((warehouse: any) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} - {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {sourceWarehouses.length === 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No assigned source warehouse was found for your user. Ask an owner to assign your
                user to a branch with a warehouse.
              </p>
            )}
            <Input
              label="Quantity"
              type="number"
              min="1"
              value={transferForm.quantity || ""}
              onChange={(e) =>
                setTransferForm({ ...transferForm, quantity: parseInt(e.target.value) || 1 })
              }
              required
            />
            <Input
              label="Notes"
              value={transferForm.notes}
              onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              placeholder="Reason or transfer reference"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={transferSaving || sourceWarehouses.length === 0}
            >
              {transferSaving ? "Transferring..." : "Transfer Stock"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={stockDialog.open}
        onOpenChange={(open) => setStockDialog({ ...stockDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>{stockDialog.product?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStockAdjust} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Current stock:{" "}
              <strong>
                {stockDialog.product?.stock} {stockDialog.product?.unit}
              </strong>
            </p>
            <Input
              label="Quantity Change"
              type="number"
              value={stockForm.quantity || ""}
              onChange={(e) =>
                setStockForm({ ...stockForm, quantity: parseInt(e.target.value) || 0 })
              }
              placeholder="Use positive for additions, negative for removals"
              required
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium">Type</label>
              <select
                value={stockForm.type}
                onChange={(e) => setStockForm({ ...stockForm, type: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="RETURN">Return</option>
                <option value="DAMAGE">Damage</option>
                <option value="LOST">Lost</option>
                <option value="FOUND">Found</option>
              </select>
            </div>
            <Input
              label="Notes"
              value={stockForm.notes}
              onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
              placeholder="Reason for adjustment"
            />
            <Button type="submit" className="w-full" disabled={stockAdjusting}>
              {stockAdjusting ? "Adjusting..." : "Adjust Stock"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={logDialog.open} onOpenChange={(open) => setLogDialog({ ...logDialog, open })}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stock Ledger</DialogTitle>
            <DialogDescription>{logDialog.productName}</DialogDescription>
          </DialogHeader>
          {logLoading ? (
            <div className="flex items-center justify-center py-8">
              <TableSkeleton />
            </div>
          ) : logDialog.logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No stock movements recorded
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logDialog.logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{formatDate(log.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {log.type}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={
                          log.quantity < 0
                            ? "font-medium text-red-600"
                            : "font-medium text-green-600"
                        }
                      >
                        {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                      </TableCell>
                      <TableCell>{log.beforeStock}</TableCell>
                      <TableCell>{log.afterStock}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.reference || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function SmallMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b px-4 py-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function OperationIcon({ label }: { label: string }) {
  const Icon =
    label === "Receipts"
      ? Truck
      : label === "Delivery Orders"
        ? Package
        : label === "Internal Transfers"
          ? RefreshCw
          : label === "Replenishment"
            ? Boxes
            : Warehouse;
  return <Icon className="h-5 w-5 text-muted-foreground" />;
}

function ReportCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
        </div>
        <LineChart className="h-5 w-5 text-muted-foreground" />
      </div>
    </Card>
  );
}

function MovesTable({ moves }: { moves: any[] }) {
  if (moves.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">No stock moves recorded yet</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Before</TableHead>
            <TableHead className="text-right">After</TableHead>
            <TableHead>Reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {moves.map((move) => (
            <TableRow key={move.id}>
              <TableCell className="text-xs">{formatDate(move.createdAt)}</TableCell>
              <TableCell>
                <p className="font-medium">{move.product?.name || "Product"}</p>
                <p className="text-xs text-muted-foreground">{move.product?.sku || "-"}</p>
              </TableCell>
              <TableCell>
                {move.warehouse
                  ? `${move.warehouse.code} - ${move.warehouse.name}`
                  : "Company stock"}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{move.type}</Badge>
              </TableCell>
              <TableCell
                className={
                  move.quantity < 0
                    ? "text-right font-medium text-red-600"
                    : "text-right font-medium text-green-600"
                }
              >
                {move.quantity > 0 ? `+${move.quantity}` : move.quantity}
              </TableCell>
              <TableCell className="text-right">{move.beforeStock}</TableCell>
              <TableCell className="text-right">{move.afterStock}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {move.reference || "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
