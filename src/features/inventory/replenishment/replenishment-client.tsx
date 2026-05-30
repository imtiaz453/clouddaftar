"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Search, Plus, MoreHorizontal, Eye, ArrowUpDown, Truck, CheckCircle, XCircle, Loader2, AlertCircle, Package, ClipboardList, FileText, TrendingUp, AlertTriangle, Calendar, Clock, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, cn } from "@/lib/utils";
import { getReplenishmentData } from "@/actions/inventory";
import { toast } from "sonner";

interface ReplenishmentItem {
  productId: string;
  productName: string;
  sku: string | null;
  locationId: string;
  locationName: string;
  availableQty: number;
  minStock: number;
  reorderPoint: number;
  shortfall: number;
  suggestedOrderQty: number;
  unit: string;
  lastPurchasePrice: number;
}

interface ReplenishmentClientProps {
  initialData: ReplenishmentItem[];
}

export function ReplenishmentClient({ initialData }: ReplenishmentClientProps) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getReplenishmentData();
      setData(result as unknown as ReplenishmentItem[]);
    } catch {
      toast.error("Failed to load replenishment data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const filtered = data.filter(
    (item) =>
      !search ||
      item.productName.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku || "").toLowerCase().includes(search.toLowerCase()) ||
      item.locationName.toLowerCase().includes(search.toLowerCase()),
  );

  function handleExportCSV() {
    const headers = [
      "Product,SKU,Location,Available Qty,Min Stock,Reorder Point,Shortfall,Suggested Order Qty,Last Purchase Price,Unit",
    ];
    const rows = filtered.map(
      (item) =>
        `${item.productName},${item.sku || ""},${item.locationName},${item.availableQty},${item.minStock},${item.reorderPoint},${item.shortfall},${item.suggestedOrderQty},${item.lastPurchasePrice},${item.unit}`,
    );
    const blob = new Blob([[...headers, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `replenishment-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Replenishment"
        description="Products that need to be reordered based on current stock levels"
      >
        <Button size="sm" variant="outline" onClick={handleExportCSV}>
          <FileText className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by product, SKU, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-sm"
        />
        <Card className="px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm">
            <strong className="text-amber-600">{data.length}</strong> item{data.length !== 1 ? "s" : ""} below reorder point
          </span>
        </Card>
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
              title={search ? "No items match your search" : "All products are well-stocked"}
              description={
                search
                  ? "Try a different search term"
                  : "No products are currently below their minimum stock or reorder point levels"
              }
            />
          </div>
        ) : (
          <>
            <div className="block sm:hidden">
              <div className="divide-y">
                {filtered.map((item) => {
                  const isLow = item.availableQty <= item.minStock;
                  return (
                    <div key={`${item.productId}-${item.locationId}`} className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{item.productName}</p>
                          <p className="font-mono text-xs text-muted-foreground">{item.sku || "-"}</p>
                        </div>
                        <Badge variant={isLow ? "destructive" : "warning"} className="text-[10px]">
                          {isLow ? "Low Stock" : "Below Reorder"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{item.locationName}</span>
                        <span>Available: <strong className={cn(isLow ? "text-red-600" : "text-amber-600")}>{item.availableQty}</strong></span>
                        <span>Min: {item.minStock}</span>
                        <span>Reorder: {item.reorderPoint || item.minStock}</span>
                        <span>Shortfall: <strong className="text-red-600">{item.shortfall}</strong></span>
                        <span>Suggested: <strong className="text-green-600">{item.suggestedOrderQty}</strong></span>
                        <span>Last Cost: {formatCurrency(item.lastPurchasePrice)}</span>
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
                    <TableHead>SKU</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Available Qty</TableHead>
                    <TableHead className="text-right">Min / Reorder</TableHead>
                    <TableHead className="text-right">Shortfall</TableHead>
                    <TableHead className="text-right">Suggested Order</TableHead>
                    <TableHead className="text-right">Last Purchase Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => {
                    const isLow = item.availableQty <= item.minStock;
                    return (
                      <TableRow
                        key={`${item.productId}-${item.locationId}`}
                        className={cn(isLow ? "bg-red-50/50 dark:bg-red-950/10" : "bg-amber-50/50 dark:bg-amber-950/10")}
                      >
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.sku || "-"}
                        </TableCell>
                        <TableCell className="text-sm">{item.locationName}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn("font-medium", isLow ? "text-red-600" : "text-amber-600")}>
                            {item.availableQty}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.minStock}{item.reorderPoint > 0 ? ` / ${item.reorderPoint}` : ""}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {item.shortfall}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {item.suggestedOrderQty}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(item.lastPurchasePrice)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
