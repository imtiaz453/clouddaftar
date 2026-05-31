"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight, Eye } from "lucide-react";
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
import { getStockAdjustments } from "@/actions/inventory";
import { AdjustmentCreateDialog } from "./adjustment-create-dialog";
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

interface AdjustmentsListClientProps {
  initialData: PaginatedData;
}

export function AdjustmentsListClient({ initialData }: AdjustmentsListClientProps) {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Adjustment | null>(null);
  const { addToast } = useToast();

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
      addToast({ title: "Failed to load adjustments", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Adjustments"
        description="Manage inventory adjustments for corrections, damages, losses, and more"
      >
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Adjustment
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
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="block sm:hidden">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No adjustments found
                </div>
              ) : (
                <div className="divide-y">
                  {filtered.map((adj) => (
                    <button
                      key={adj.id}
                      className="flex w-full flex-col gap-1.5 p-3 text-left hover:bg-muted/50"
                      onClick={() => openDetail(adj)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-medium">{adj.referenceNumber}</span>
                        <Badge variant={reasonVariants[adj.reason] || "secondary"} className="text-[10px]">
                          {reasonLabels[adj.reason] || adj.reason}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{adj.location.name}</span>
                        <span>{adj.items.length} item(s)</span>
                        <span>{formatDate(adj.createdAt)}</span>
                        <span>By: {adj.createdBy.name}</span>
                      </div>
                      {adj.notes && (
                        <p className="truncate text-xs text-muted-foreground">{adj.notes}</p>
                      )}
                    </button>
                  ))}
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
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No adjustments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((adj) => (
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
                        <TableCell className="text-right text-sm">{adj.items.length}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(adj.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {adj.createdBy.name}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
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

      <AdjustmentCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => loadPage(1)}
      />

      {selected && (
        <AdjustmentDetailClient
          adjustment={selected}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}
    </div>
  );
}
