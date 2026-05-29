"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Building2,
  DollarSign,
  Truck,
  AlertTriangle,
  ArrowRight,
  Plus,
  ArrowRightLeft,
  ClipboardCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import { getInventoryDashboardData } from "@/actions/inventory-new";

interface LowStockItem {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  minStock: number;
}

interface StockByLocation {
  locationId: string;
  locationName: string;
  totalQty: number;
  totalValue: number;
  productCount: number;
}

interface RecentMovement {
  id: string;
  productName: string;
  locationName: string;
  movementType: string;
  quantity: number;
  qtyOnHandAfter: number;
  createdBy: string;
  createdAt: string;
}

interface DashboardData {
  totalProducts: number;
  totalSkuWithStock: number;
  totalLocations: number;
  totalStockQty: number;
  totalStockValue: number;
  lowStockCount: number;
  lowStockItems: LowStockItem[];
  outOfStockCount: number;
  pendingTransferCount: number;
  recentMovements: RecentMovement[];
  stockByLocation: StockByLocation[];
}

interface InventoryDashboardClientProps {
  initialData: DashboardData;
}

function MovementBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    PURCHASE_RECEIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    SALE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    TRANSFER_IN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    TRANSFER_OUT: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    ADJUSTMENT_IN: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    ADJUSTMENT_OUT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    STOCK_COUNT_CORRECTION: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  };

  const label = type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[type] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
      }`}
    >
      {label}
    </span>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-2 h-8 w-28" />
          <Skeleton className="mt-1 h-3 w-16" />
        </Card>
      ))}
    </div>
  );
}

function TableSkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function InventoryDashboardClient({ initialData }: InventoryDashboardClientProps) {
  const { addToast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        if (initialData) {
          setData(initialData);
          setLoading(false);
          return;
        }
        const result = await getInventoryDashboardData();
        setData(result);
      } catch {
        addToast({ title: "Failed to load inventory dashboard", variant: "error" });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [initialData, addToast]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inventory Dashboard" description="Overview of stock, locations, and movements" />
        <SummarySkeleton />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-0">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-5 w-32" />
            </div>
            <TableSkeletonRows rows={4} />
          </Card>
          <Card className="p-0">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-5 w-36" />
            </div>
            <TableSkeletonRows rows={4} />
          </Card>
        </div>
        <Card className="p-0">
          <div className="border-b px-4 py-3">
            <Skeleton className="h-5 w-40" />
          </div>
          <TableSkeletonRows rows={5} />
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inventory Dashboard" description="Overview of stock, locations, and movements" />
        <Card className="flex flex-col items-center justify-center py-16">
          <Package className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">No inventory data</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by creating your first product
          </p>
          <Link href="/inventory/products" className="mt-4">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Product
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const hasProducts = data.totalSkuWithStock > 0 || data.totalProducts > 0;

  if (!hasProducts) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inventory Dashboard" description="Overview of stock, locations, and movements" />
        <Card className="flex flex-col items-center justify-center py-16">
          <Package className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">No inventory data</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by creating your first product
          </p>
          <Link href="/inventory/products" className="mt-4">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Product
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Dashboard" description="Overview of stock, locations, and movements">
        <Link href="/inventory/products">
          <Button size="sm" variant="outline">
            <Plus className="mr-1.5 h-4 w-4" />
            New Product
          </Button>
        </Link>
        <Link href="/inventory/transfers">
          <Button size="sm" variant="outline">
            <ArrowRightLeft className="mr-1.5 h-4 w-4" />
            New Transfer
          </Button>
        </Link>
        <Link href="/inventory/adjustments">
          <Button size="sm" variant="outline">
            <ClipboardCheck className="mr-1.5 h-4 w-4" />
            New Adjustment
          </Button>
        </Link>
        <Link href="/inventory/stock-counts">
          <Button size="sm">
            <ClipboardCheck className="mr-1.5 h-4 w-4" />
            Stock Count
          </Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Total SKUs</p>
            <Package className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{data.totalSkuWithStock}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.totalProducts} total products
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Stock Value</p>
            <DollarSign className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatCurrency(data.totalStockValue)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.totalStockQty} units on hand
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Locations</p>
            <Building2 className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{data.totalLocations}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Active stock locations</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pending Transfers</p>
            <Truck className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{data.pendingTransferCount}</p>
          <Link
            href="/inventory/transfers"
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View transfers
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Low Stock Alert</h2>
              <p className="text-xs text-muted-foreground">
                Products at or below minimum stock level
              </p>
            </div>
            {data.lowStockCount > 0 && (
              <Link href="/inventory/low-stock">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View All
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>
          {data.lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <AlertTriangle className="mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No low stock items</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lowStockItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.sku || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {item.stock}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.minStock}</TableCell>
                    <TableCell>
                      <Badge variant={item.stock === 0 ? "destructive" : "warning"}>
                        {item.stock === 0 ? "Out of Stock" : "Warning"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="p-0">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Stock by Location</h2>
            <p className="text-xs text-muted-foreground">
              Distribution of stock across locations
            </p>
          </div>
          {data.stockByLocation.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Building2 className="mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No stock locations</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.stockByLocation.map((loc) => (
                  <TableRow key={loc.locationId}>
                    <TableCell className="font-medium">{loc.locationName}</TableCell>
                    <TableCell className="text-right tabular-nums">{loc.totalQty}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(loc.totalValue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{loc.productCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Recent Stock Movements</h2>
          <p className="text-xs text-muted-foreground">
            Last {data.recentMovements.length} transactions across all locations
          </p>
        </div>
        {data.recentMovements.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Truck className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No recent movements</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / Time</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentMovements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(m.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">{m.productName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.locationName}
                  </TableCell>
                  <TableCell>
                    <MovementBadge type={m.movementType} />
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-medium ${
                      m.quantity < 0
                        ? "text-red-600"
                        : m.quantity > 0
                          ? "text-green-600"
                          : ""
                    }`}
                  >
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {m.qtyOnHandAfter}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
