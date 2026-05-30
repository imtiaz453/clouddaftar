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
import { formatDateTime, cn } from "@/lib/utils";
import { getStockCounts, reviewStockCountAction, postStockCountAction } from "@/actions/inventory";
import { toast } from "sonner";
import { StockCountFormDialog } from "./stock-count-form-dialog";
import { StockCountDetailClient } from "./stock-count-detail-client";

interface StockCount {
  id: string;
  referenceNumber: string;
  location: { id: string; name: string };
  status: string;
  notes: string | null;
  frozenAt: string;
  postedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
  _count: { items: number };
}

interface PaginatedData {
  data: StockCount[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "warning" | "success" | "outline" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  IN_PROGRESS: { label: "In Progress", variant: "default" },
  REVIEWED: { label: "Reviewed", variant: "warning" },
  POSTED: { label: "Posted", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

interface StockCountsClientProps {
  initialData: PaginatedData;
}

export function StockCountsClient({ initialData }: StockCountsClientProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<StockCount | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  const loadPage = useCallback(async (newPage: number) => {
    setPage(newPage);
    setLoading(true);
    try {
      const result = await getStockCounts({ page: newPage, pageSize: 20 });
      setData(result as unknown as PaginatedData);
    } catch {
      toast.error("Failed to load stock counts");
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = data.data.filter(
    (sc) =>
      !search ||
      sc.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      sc.location.name.toLowerCase().includes(search.toLowerCase()) ||
      sc.status.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleReview(count: StockCount, e: React.MouseEvent) {
    e.stopPropagation();
    setActingId(count.id);
    try {
      await reviewStockCountAction(count.id);
      toast.success("Stock count reviewed");
      loadPage(page);
    } catch (err) {
      toast.error("Failed to review", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setActingId(null);
    }
  }

  async function handlePost(count: StockCount, e: React.MouseEvent) {
    e.stopPropagation();
    setActingId(count.id);
    try {
      await postStockCountAction(count.id);
      toast.success("Stock count posted");
      loadPage(page);
    } catch (err) {
      toast.error("Failed to post", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setActingId(null);
    }
  }

  function openDetail(count: StockCount) {
    setSelected(count);
    setDetailOpen(true);
  }

  const statusVariant = (status: string) =>
    statusConfig[status] || { label: status, variant: "secondary" as const };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Counts"
        description="Count inventory to reconcile actual stock with recorded quantities"
      >
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Stock Count
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by reference, location, status..."
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
              title={search ? "No stock counts match your search" : "No stock counts yet"}
              description={
                search
                  ? "Try a different search term"
                  : "Create a stock count to start reconciling inventory"
              }
              action={
                !search ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Stock Count
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="block sm:hidden">
              <div className="divide-y">
                {filtered.map((sc) => {
                  const cfg = statusVariant(sc.status);
                  return (
                    <button
                      key={sc.id}
                      className="flex w-full flex-col gap-1.5 p-3 text-left hover:bg-muted/50"
                      onClick={() => openDetail(sc)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-medium">{sc.referenceNumber}</span>
                        <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{sc.location.name}</span>
                        <span>{sc._count.items} items</span>
                        <span>{formatDateTime(sc.createdAt)}</span>
                        <span>By: {sc.createdBy.name}</span>
                      </div>
                      <div className="flex gap-1 pt-1">
                        {(sc.status === "DRAFT" || sc.status === "IN_PROGRESS") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(sc);
                            }}
                          >
                            <Eye className="mr-1 h-3 w-3" /> View
                          </Button>
                        )}
                        {sc.status === "REVIEWED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => handlePost(sc, e)}
                            disabled={actingId === sc.id}
                          >
                            {actingId === sc.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle className="mr-1 h-3 w-3" />
                            )}
                            Post
                          </Button>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((sc) => {
                    const cfg = statusVariant(sc.status);
                    return (
                      <TableRow
                        key={sc.id}
                        className="cursor-pointer"
                        onClick={() => openDetail(sc)}
                      >
                        <TableCell className="font-mono text-xs font-medium">
                          {sc.referenceNumber}
                        </TableCell>
                        <TableCell className="text-sm">{sc.location.name}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{sc._count.items}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {sc.createdBy.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(sc.createdAt)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openDetail(sc)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {sc.status === "IN_PROGRESS" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => handleReview(sc, e)}
                                disabled={actingId === sc.id}
                              >
                                {actingId === sc.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3.5 w-3.5 text-amber-600" />
                                )}
                              </Button>
                            )}
                            {sc.status === "REVIEWED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => handlePost(sc, e)}
                                disabled={actingId === sc.id}
                              >
                                {actingId === sc.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      <StockCountFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => loadPage(1)}
      />

      {selected && (
        <StockCountDetailClient
          countId={selected.id}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onUpdated={() => loadPage(page)}
        />
      )}
    </div>
  );
}
