"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Package, Trash2, ArrowLeft, Pencil, History, Loader2, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { dashboardHref } from "@/lib/dashboard-href";
import { deleteProduct } from "@/actions/inventory";
import { toast } from "sonner";

interface StockBalance {
  id: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  reorderPoint: number;
  location: { id: string; name: string; code: string; type: string };
}

interface LotStock {
  location: { id: string; name: string };
  quantity: number;
}

interface ProductLot {
  id: string;
  lotNumber: string;
  serialNumber: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  isActive: boolean;
  stocks: LotStock[];
}

interface LedgerEntry {
  id: string;
  movementType: string;
  quantity: number;
  qtyOnHandBefore: number;
  qtyOnHandAfter: number;
  qtyReservedBefore: number;
  qtyReservedAfter: number;
  reference: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
  location: { name: string };
  createdBy: { name: string; email: string } | null;
}

interface SaleRecord {
  quantity: number;
  price: number;
  subtotal: number;
  sale: {
    id: string;
    invoiceNumber: string;
    createdAt: string;
    status: string;
    total: number;
    customer: { name: string } | null;
  };
}

interface PurchaseRecord {
  quantity: number;
  price: number;
  subtotal: number;
  purchase: {
    id: string;
    referenceNumber: string;
    createdAt: string;
    status: string;
    total: number;
    supplier: { name: string } | null;
  };
}

interface ProductDetailData {
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    description: string | null;
    image: string | null;
    unit: string;
    minStock: number;
    maxStock: number | null;
    purchasePrice: number;
    sellingPrice: number;
    wholesalePrice: number | null;
    tax: number;
    isActive: boolean;
    isService: boolean;
    trackingMode: string;
    category: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
  };
  stockBalances: StockBalance[];
  ledger: LedgerEntry[];
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  lots: ProductLot[];
}

interface ProductDetailClientProps {
  data: ProductDetailData;
}

export function ProductDetailClient({ data }: ProductDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [deleting, setDeleting] = useState(false);

  if (!data?.product) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
        <h1 className="text-lg font-semibold">Product not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The product may have been deleted or you may not have access to it.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => router.push(dashboardHref(pathname, "/inventory/products"))}
        >
          Back to products
        </Button>
      </div>
    );
  }
  const { product, stockBalances, ledger, sales, purchases, lots } = data;

  const totalOnHand = stockBalances.reduce((s, b) => s + Number(b.qtyOnHand), 0);
  const totalReserved = stockBalances.reduce((s, b) => s + Number(b.qtyReserved), 0);
  const totalAvailable = stockBalances.reduce((s, b) => s + Number(b.qtyAvailable), 0);
  const stockValue = stockBalances.reduce(
    (s, b) => s + Number(b.qtyOnHand) * Number(product.purchasePrice),
    0,
  );
  const isLowStock = totalOnHand > 0 && totalOnHand <= product.minStock;
  const isOutOfStock = totalOnHand === 0 && !product.isService;

  async function handleDelete() {
    if (!confirm("Delete this product? This action can be undone.")) return;
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      toast.success("Product deleted");
      router.push(dashboardHref(pathname, "/inventory/products"));
    } catch (err) {
      toast.error("Error deleting product", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  const stockStatusBadge = isOutOfStock ? (
    <Badge variant="destructive">Out of Stock</Badge>
  ) : isLowStock ? (
    <Badge variant="warning">Low Stock</Badge>
  ) : product.isService ? (
    <Badge variant="secondary">Service</Badge>
  ) : (
    <Badge variant="success">In Stock</Badge>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Products</p>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
            {stockStatusBadge}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {product.sku && (
              <span>
                SKU: <span className="font-mono">{product.sku}</span>
              </span>
            )}
            {product.barcode && (
              <span>
                Barcode: <span className="font-mono">{product.barcode}</span>
              </span>
            )}
            <span>Unit: {product.unit}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(dashboardHref(pathname, "/inventory/products"))}
          >
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              router.push(
                dashboardHref(pathname, "/inventory/adjustments", { productId: product.id }),
              )
            }
          >
            <Package className="mr-2 h-4 w-4" /> Adjust Stock
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              router.push(
                dashboardHref(pathname, "/inventory/transfers", { productId: product.id }),
              )
            }
          >
            <ArrowUpDown className="mr-2 h-4 w-4" /> Transfer
          </Button>
          {product.trackingMode !== "NONE" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                router.push(dashboardHref(pathname, "/inventory/lots", { productId: product.id }))
              }
            >
              + Lot
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              router.push(dashboardHref(pathname, "/inventory/ledger", { productId: product.id }))
            }
          >
            <History className="mr-2 h-4 w-4" /> Ledger
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total On Hand</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {totalOnHand}{" "}
            <span className="text-sm font-normal text-muted-foreground">{product.unit}</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Reserved</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalReserved}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Available</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalAvailable}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Stock Value</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(stockValue)}</p>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stock">Stock by Location</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="lots">Lots / Batches</TabsTrigger>
          <TabsTrigger value="history">Sales & Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-medium">Product Details</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="text-sm font-medium">{product.category?.name || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tracking Mode</p>
                <p className="text-sm font-medium">
                  {product.trackingMode === "NONE" ? "None" : product.trackingMode}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-medium">{product.isActive ? "Active" : "Inactive"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Min Stock</p>
                <p className="text-sm font-medium">
                  {product.minStock} {product.unit}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max Stock</p>
                <p className="text-sm font-medium">
                  {product.maxStock ? `${product.maxStock} ${product.unit}` : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tax</p>
                <p className="text-sm font-medium">{Number(product.tax)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Purchase Price</p>
                <p className="text-sm font-medium">{formatCurrency(product.purchasePrice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Selling Price</p>
                <p className="text-sm font-medium">{formatCurrency(product.sellingPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Wholesale Price</p>
                <p className="text-sm font-medium">
                  {product.wholesalePrice ? formatCurrency(product.wholesalePrice) : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{formatDateTime(product.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Updated</p>
                <p className="text-sm">{formatDateTime(product.updatedAt)}</p>
              </div>
            </div>
            {product.description && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="mt-1 text-sm">{product.description}</p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <Card>
            {stockBalances.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No stock at any location
              </div>
            ) : (
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">On Hand</TableHead>
                      <TableHead className="text-right">Reserved</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockBalances.map((sb) => (
                      <TableRow key={sb.id}>
                        <TableCell className="font-medium">{sb.location.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {sb.location.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {Number(sb.qtyOnHand)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {Number(sb.qtyReserved)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(sb.qtyAvailable)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(Number(sb.qtyOnHand) * Number(product.purchasePrice))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="grid gap-2 p-3 sm:hidden">
              {stockBalances.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No stock at any location
                </p>
              ) : (
                stockBalances.map((sb) => (
                  <div
                    key={sb.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{sb.location.name}</p>
                      <p className="text-xs text-muted-foreground">{sb.location.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{Number(sb.qtyOnHand)}</p>
                      <p className="text-xs text-muted-foreground">
                        Avail: {Number(sb.qtyAvailable)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="space-y-4">
          <Card>
            {ledger.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No stock movements recorded
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {entry.movementType.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{entry.location.name}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          Number(entry.quantity) < 0 ? "text-red-600" : "text-green-600",
                        )}
                      >
                        {Number(entry.quantity) > 0
                          ? `+${Number(entry.quantity)}`
                          : Number(entry.quantity)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {Number(entry.qtyOnHandBefore)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {Number(entry.qtyOnHandAfter)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.reference || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.createdBy?.name || entry.createdBy?.email || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="lots" className="space-y-4">
          <Card>
            {lots.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {product.trackingMode === "NONE"
                  ? "This product does not use lot or serial tracking"
                  : "No lots or batches registered yet"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot / Serial</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>MFG Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Locations</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((lot) => {
                    const totalQty = lot.stocks.reduce((s, st) => s + st.quantity, 0);
                    return (
                      <TableRow key={lot.id}>
                        <TableCell className="font-mono text-xs font-medium">
                          {lot.serialNumber || lot.lotNumber}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={lot.serialNumber ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {lot.serialNumber ? "Serial" : "Lot"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {lot.mfgDate ? formatDateTime(lot.mfgDate) : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {lot.expiryDate ? (
                            <span
                              className={
                                new Date(lot.expiryDate) < new Date()
                                  ? "font-medium text-red-600"
                                  : ""
                              }
                            >
                              {formatDateTime(lot.expiryDate)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {lot.stocks.map((st) => `${st.location.name}: ${st.quantity}`).join(", ")}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {totalQty}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="border-b border-border/60 px-4 py-3">
                <h3 className="text-sm font-semibold">Recent Sales</h3>
              </div>
              {sales.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No sales recorded
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{s.sale.invoiceNumber}</TableCell>
                        <TableCell className="text-xs">{s.sale.customer?.name || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(Number(s.subtotal))}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDateTime(s.sale.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
            <Card>
              <div className="border-b border-border/60 px-4 py-3">
                <h3 className="text-sm font-semibold">Recent Purchases</h3>
              </div>
              {purchases.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No purchases recorded
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">
                          {p.purchase.referenceNumber}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.purchase.supplier?.name || "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(Number(p.subtotal))}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDateTime(p.purchase.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
