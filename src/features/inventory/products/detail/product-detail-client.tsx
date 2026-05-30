"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Package,
  Edit,
  Trash2,
  ArrowLeft,
  Layers,
  History,
  DollarSign,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { dashboardHref } from "@/lib/dashboard-href";
import { deleteProduct } from "@/actions/inventory";
import { useToast } from "@/providers/toast-provider";

interface StockBalance {
  id: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  reorderPoint: number;
  location: { id: string; name: string; code: string; type: string };
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
    stock: number;
    minStock: number;
    maxStock: number | null;
    purchasePrice: number;
    sellingPrice: number;
    wholesalePrice: number | null;
    unit: string;
    tax: number;
    discount: number;
    isActive: boolean;
    isService: boolean;
    trackingMode: string;
    mfgDate: string | null;
    expiryDate: string | null;
    category: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
  };
  stockBalances: StockBalance[];
  ledger: LedgerEntry[];
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
}

interface ProductDetailClientProps {
  data: ProductDetailData;
}

export function ProductDetailClient({ data }: ProductDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const { product, stockBalances, ledger, sales, purchases } = data;

  const totalStock = stockBalances.reduce((s, b) => s + Number(b.qtyOnHand), 0);
  const totalReserved = stockBalances.reduce((s, b) => s + Number(b.qtyReserved), 0);
  const totalAvailable = stockBalances.reduce((s, b) => s + Number(b.qtyAvailable), 0);
  const stockValue = Number(product.purchasePrice) * totalStock;
  const isLowStock = totalStock <= product.minStock;

  async function handleDelete() {
    if (!confirm("Delete this product? This action can be undone.")) return;
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      addToast({ title: "Product deleted", variant: "success" });
      router.push(dashboardHref(pathname, "/inventory/products"));
    } catch {
      addToast({ title: "Error deleting product", variant: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const statusBadge = isLowStock
    ? <Badge variant="warning">Low Stock</Badge>
    : totalStock === 0
      ? <Badge variant="destructive">Out of Stock</Badge>
      : <Badge variant="success">In Stock</Badge>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Inventory</p>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
            {statusBadge}
          </div>
          {product.sku && <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push(dashboardHref(pathname, "/inventory/products"))}>
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Stock</p>
          <p className="mt-1 text-xl font-semibold">{totalStock}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Reserved</p>
          <p className="mt-1 text-xl font-semibold">{totalReserved}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Available</p>
          <p className="mt-1 text-xl font-semibold">{totalAvailable}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Selling Price</p>
          <p className="mt-1 text-xl font-semibold">{formatCurrency(Number(product.sellingPrice))}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Stock Value</p>
          <p className="mt-1 text-xl font-semibold">{formatCurrency(stockValue)}</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview"><Package className="mr-2 h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="locations"><Layers className="mr-2 h-4 w-4" /> Stock by Location</TabsTrigger>
          <TabsTrigger value="ledger"><History className="mr-2 h-4 w-4" /> Ledger</TabsTrigger>
          <TabsTrigger value="pricing"><DollarSign className="mr-2 h-4 w-4" /> Pricing</TabsTrigger>
          <TabsTrigger value="history"><TrendingUp className="mr-2 h-4 w-4" /> Sales & Purchases</TabsTrigger>
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
                <p className="text-xs text-muted-foreground">Unit</p>
                <p className="text-sm font-medium">{product.unit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tracking Mode</p>
                <p className="text-sm font-medium">{product.trackingMode}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Min Stock</p>
                <p className="text-sm font-medium">{product.minStock}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max Stock</p>
                <p className="text-sm font-medium">{product.maxStock ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-medium">{product.isActive ? "Active" : "Inactive"}</p>
              </div>
              {product.barcode && (
                <div>
                  <p className="text-xs text-muted-foreground">Barcode</p>
                  <p className="text-sm font-mono">{product.barcode}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{formatDate(product.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Updated</p>
                <p className="text-sm">{formatDate(product.updatedAt)}</p>
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

        <TabsContent value="locations" className="space-y-4">
          <Card>
            {stockBalances.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No stock at any location
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>On Hand</TableHead>
                    <TableHead>Reserved</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockBalances.map((sb) => (
                    <TableRow key={sb.id}>
                      <TableCell className="font-medium">{sb.location.name}</TableCell>
                      <TableCell><Badge variant="secondary">{sb.location.type}</Badge></TableCell>
                      <TableCell>{Number(sb.qtyOnHand)}</TableCell>
                      <TableCell className="text-muted-foreground">{Number(sb.qtyReserved)}</TableCell>
                      <TableCell>{Number(sb.qtyAvailable)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatCurrency(Number(sb.qtyOnHand) * Number(product.purchasePrice))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
                    <TableHead>Qty</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs">{formatDate(entry.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {entry.movementType.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{entry.location.name}</TableCell>
                      <TableCell className="font-medium">{Number(entry.quantity)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{Number(entry.qtyOnHandBefore)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{Number(entry.qtyOnHandAfter)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.reference || "-"}</TableCell>
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

        <TabsContent value="pricing" className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-medium">Pricing Details</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Purchase Price</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(Number(product.purchasePrice))}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Selling Price</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(Number(product.sellingPrice))}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Wholesale Price</p>
                <p className="mt-1 text-lg font-semibold">
                  {product.wholesalePrice ? formatCurrency(Number(product.wholesalePrice)) : "-"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Margin</p>
                <p className="mt-1 text-lg font-semibold">
                  {Number(product.purchasePrice) > 0
                    ? `${Math.round((Number(product.sellingPrice) - Number(product.purchasePrice)) / Number(product.purchasePrice) * 100)}%`
                    : "-"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Tax</p>
                <p className="mt-1 text-lg font-semibold">{Number(product.tax)}%</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Discount</p>
                <p className="mt-1 text-lg font-semibold">{Number(product.discount)}%</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="flex items-center gap-2 border-b border-border/60 p-3">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Recent Sales</h3>
              </div>
              {sales.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No sales yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{s.sale.invoiceNumber}</TableCell>
                        <TableCell className="text-xs">{s.sale.customer?.name || "-"}</TableCell>
                        <TableCell>{s.quantity}</TableCell>
                        <TableCell>{formatCurrency(Number(s.subtotal))}</TableCell>
                        <TableCell className="text-xs">{formatDate(s.sale.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
            <Card>
              <div className="flex items-center gap-2 border-b border-border/60 p-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Recent Purchases</h3>
              </div>
              {purchases.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No purchases yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{p.purchase.referenceNumber}</TableCell>
                        <TableCell className="text-xs">{p.purchase.supplier?.name || "-"}</TableCell>
                        <TableCell>{p.quantity}</TableCell>
                        <TableCell>{formatCurrency(Number(p.subtotal))}</TableCell>
                        <TableCell className="text-xs">{formatDate(p.purchase.createdAt)}</TableCell>
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
