"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight, Play, CheckCircle, Send, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import {
  getStockCounts,
  reviewStockCountAction,
  postStockCountAction,
} from "@/actions/inventory";
import { CountCreateDialog } from "./count-create-dialog";

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

interface CountsListClientProps {
  initialData: PaginatedData;
}

export function CountsListClient({ initialData }: CountsListClientProps) {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { addToast } = useToast();

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
      addToast({ title: "Failed to load stock counts", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const filtered = data.data.filter(
    (sc) =>
      !search ||
      sc.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      sc.location.name.toLowerCase().includes(search.toLowerCase()) ||
      sc.status.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleReview(count: StockCount) {
    try {
      await reviewStockCountAction(count.id);
      addToast({ title: "Stock count reviewed", variant: "success" });
      loadPage(page);
    } catch (err) {
      addToast({
        title: "Failed to review",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    }
  }

  async function handlePost(count: StockCount) {
    try {
      await postStockCountAction(count.id);
      addToast({ title: "Stock count posted", variant: "success" });
      loadPage(page);
    } catch (err) {
      addToast({
        title: "Failed to post",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    }
  }

  function statusAction(count: StockCount) {
    switch (count.status) {
      case "DRAFT":
        return (
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Play className="mr-1 h-3 w-3" /> Start Count
          </Button>
        );
      case "IN_PROGRESS":
        return (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleReview(count)}>
            <CheckCircle className="mr-1 h-3 w-3" /> Review
          </Button>
        );
      case "REVIEWED":
        return (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handlePost(count)}>
            <Send className="mr-1 h-3 w-3" /> Post
          </Button>
        );
      case "POSTED":
        return (
          <Button variant="ghost" size="sm" className="h-7 text-xs" disabled>
            <Eye className="mr-1 h-3 w-3" /> View
          </Button>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Counts"
        description="Count inventory to reconcile actual stock with recorded quantities"
      >
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Stock Count
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
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="block sm:hidden">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No stock counts found
                </div>
              ) : (
                <div className="divide-y">
                  {filtered.map((sc) => {
                    const cfg = statusConfig[sc.status] || { label: sc.status, variant: "secondary" as const };
                    return (
                      <div key={sc.id} className="space-y-1.5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-medium">{sc.referenceNumber}</span>
                          <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{sc.location.name}</span>
                          <span>{sc._count.items} item(s)</span>
                          <span>Frozen: {formatDate(sc.frozenAt)}</span>
                          <span>By: {sc.createdBy.name}</span>
                        </div>
                        {sc.notes && (
                          <p className="truncate text-xs text-muted-foreground">{sc.notes}</p>
                        )}
                        <div className="pt-1">{statusAction(sc)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead>Frozen At</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No stock counts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((sc) => {
                      const cfg = statusConfig[sc.status] || { label: sc.status, variant: "secondary" as const };
                      return (
                        <TableRow key={sc.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {sc.referenceNumber}
                          </TableCell>
                          <TableCell className="text-sm">{sc.location.name}</TableCell>
                          <TableCell>
                            <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">{sc._count.items}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(sc.frozenAt)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {sc.createdBy.name}
                          </TableCell>
                          <TableCell>{statusAction(sc)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Pagination */}
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
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => loadPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <CountCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => loadPage(1)}
      />
    </div>
  );
}
