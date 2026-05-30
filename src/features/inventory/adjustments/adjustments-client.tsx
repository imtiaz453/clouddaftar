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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { getStockAdjustments, postStockAdjustmentAction } from "@/actions/inventory";
import { toast } from "sonner";
import { AdjustmentFormDialog } from "./adjustment-form-dialog";
import { AdjustmentDetailClient } from "./adjustment-detail-client";

interface AdjustmentItem {
  id: string;
  product: { name: string; sku: string | null };
  direction: string;
  quantity: number;
  unitCost: number;
}

interface Adjustment {
  id: string;
  referenceNumber: string;
  location: { id: string; name: string };
  reason: string;
  notes: string | null;
  postedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  items: AdjustmentItem[];
}

interface PaginatedData {
  data: Adjustment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface AdjustmentsClientProps {
  initialData: PaginatedData;
}

const reasonLabels: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance",
  CORRECTION: "Correction",
  DAMAGE: "Damage",
  EXPIRED: "Expired",
  LOST: "Lost",
  FOUND: "Found",
  INTERNAL_USE: "Internal Use",
};

const reasonVariants: Record<string, "default" | "secondary" | "destructive" | "warning" | "success" | "outline"> = {
  OPENING_BALANCE: "default",
  CORRECTION: "secondary",
  DAMAGE: "destructive",
  EXPIRED: "warning",
  LOST: "outline",
  FOUND: "success",
  INTERNAL_USE: "warning",
};

export function AdjustmentsClient({ initialData }: AdjustmentsClientProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Adjustment | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);

  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  const loadPage = useCallback(async (newPage: number) => {
    setPage(newPage);
    setLoading(true);
    try {
      const result = await getStockAdjustments({ page: newPage, pageSize: 20 });
      setData(result as unknown as PaginatedData);
    } catch {
      toast.error("Failed to load adjustments");
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = data.data.filter(
    (adj) =>
      !search ||
      adj.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      adj.location.name.toLowerCase().includes(search.toLowerCase()) ||
      adj.reason.toLowerCase().includes(search.toLowerCase()),
  );

  function openDetail(adj: Adjustment) {
    setSelected(adj);
    setDetailOpen(true);
  }

  async function handlePost(adj: Adjustment, e: React.MouseEvent) {
    e.stopPropagation();
    setPostingId(adj.id);
    try {
      await postStockAdjustmentAction(adj.id);
      toast.success("Adjustment posted");
      loadPage(page);
    } catch (err) {
      toast.error("Failed to post adjustment", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setPostingId(null);
    }
  }

  const totalItemsCount = (items: AdjustmentItem[]) =>
    items.reduce((s, i) => s + Number(i.quantity), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Adjustments"
        description="Manage inventory adjustments for corrections, damages, losses, and more"
      >
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Adjustment
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by reference, location, reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-sm"
        />
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
              icon={ClipboardList}
              title={search ? "No adjustments match your search" : "No adjustments yet"}
              description={
                search
                  ? "Try a different search term"
                  : "Create a stock adjustment to correct or modify inventory levels"
              }
              action={
                !search ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Adjustment
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="block sm:hidden">
              <div className="divide-y">
                {filtered.map((adj) => (
                  <button
                    key={adj.id}
                    className="flex w-full flex-col gap-1.5 p-3 text-left hover:bg-muted/50"
                    onClick={() => openDetail(adj)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-medium">{adj.referenceNumber}</span>
                      {adj.postedAt ? (
                        <Badge variant="success" className="text-[10px]">Posted</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Draft</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{adj.location.name}</span>
                      <Badge variant={reasonVariants[adj.reason] || "secondary"} className="text-[10px]">
                        {reasonLabels[adj.reason] || adj.reason}
                      </Badge>
                      <span>{adj.items.length} items</span>
                      <span>Qty: {totalItemsCount(adj.items)}</span>
                      <span>{formatDateTime(adj.createdAt)}</span>
                      <span>By: {adj.createdBy.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((adj) => (
                    <TableRow
                      key={adj.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(adj)}
                    >
                      <TableCell className="font-mono text-xs font-medium">
                        {adj.referenceNumber}
                      </TableCell>
                      <TableCell className="text-sm">{adj.location.name}</TableCell>
                      <TableCell>
                        <Badge variant={reasonVariants[adj.reason] || "secondary"} className="text-[10px]">
                          {reasonLabels[adj.reason] || adj.reason}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {adj.postedAt ? (
                          <Badge variant="success" className="text-[10px]">Posted</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">{adj.items.length}</TableCell>
                      <TableCell className="text-right text-sm">{totalItemsCount(adj.items)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {adj.createdBy.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(adj.createdAt)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openDetail(adj)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {!adj.postedAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-green-600"
                              onClick={(e) => handlePost(adj, e)}
                              disabled={postingId === adj.id}
                            >
                              {postingId === adj.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">{data.total} total</p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => loadPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-2 text-sm text-muted-foreground">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => loadPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <AdjustmentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => loadPage(1)}
      />

      {selected && (
        <AdjustmentDetailClient
          adjustment={selected}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onPosted={() => loadPage(page)}
        />
      )}
    </div>
  );
}
