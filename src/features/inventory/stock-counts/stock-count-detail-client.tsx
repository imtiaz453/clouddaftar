"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Search, Plus, MoreHorizontal, Eye, ArrowUpDown, Truck, CheckCircle, XCircle, Loader2, AlertCircle, Package, ClipboardList, FileText, TrendingUp, AlertTriangle, Calendar, Clock, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, cn } from "@/lib/utils";
import {
  getStockCountDetail,
  updateStockCountItemAction,
  reviewStockCountAction,
  postStockCountAction,
} from "@/actions/inventory";
import { toast } from "sonner";

interface StockCountItem {
  id: string;
  product: { id: string; name: string; sku: string | null; unit: string | null };
  expectedQty: number;
  countedQty: number;
  variance: number;
}

interface StockCountDetail {
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
  items: StockCountItem[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "warning" | "success" | "outline" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  IN_PROGRESS: { label: "In Progress", variant: "default" },
  REVIEWED: { label: "Reviewed", variant: "warning" },
  POSTED: { label: "Posted", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

interface StockCountDetailClientProps {
  countId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function StockCountDetailClient({
  countId,
  open,
  onOpenChange,
  onUpdated,
}: StockCountDetailClientProps) {
  const [detail, setDetail] = useState<StockCountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyVariances, setOnlyVariances] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getStockCountDetail(countId);
      setDetail(result as unknown as StockCountDetail);
    } catch {
      toast.error("Failed to load stock count detail");
    } finally {
      setLoading(false);
    }
  }, [countId]);

  useEffect(() => {
    if (open) loadDetail();
  }, [open, loadDetail]);

  if (!open) return null;

  function startEdit(itemId: string, currentQty: number) {
    setEditingId(itemId);
    setEditValues((prev) => ({ ...prev, [itemId]: String(currentQty) }));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({});
  }

  async function saveEdit(itemId: string) {
    const val = parseFloat(editValues[itemId]);
    if (isNaN(val) || val < 0) {
      toast.error("Counted quantity must be a valid positive number");
      return;
    }
    setSavingItem(itemId);
    try {
      await updateStockCountItemAction(countId, itemId, val);
      toast.success("Counted quantity updated");
      setEditingId(null);
      setEditValues({});
      loadDetail();
    } catch (err) {
      toast.error("Failed to update", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingItem(null);
    }
  }

  async function handleReview() {
    setActionLoading(true);
    try {
      await reviewStockCountAction(countId);
      toast.success("Stock count reviewed");
      loadDetail();
      onUpdated?.();
    } catch (err) {
      toast.error("Failed to review", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePost() {
    setActionLoading(true);
    try {
      await postStockCountAction(countId);
      toast.success("Stock count posted");
      loadDetail();
      onUpdated?.();
    } catch (err) {
      toast.error("Failed to post", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Stock Count Detail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!detail) return null;

  const cfg = statusConfig[detail.status] || { label: detail.status, variant: "secondary" as const };
  const canEdit = detail.status === "DRAFT" || detail.status === "IN_PROGRESS";
  const canReview = detail.status === "IN_PROGRESS";
  const canPost = detail.status === "REVIEWED";

  const filteredItems = detail.items.filter((item) => {
    const matchesSearch =
      !search ||
      item.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.product.sku || "").toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (onlyVariances && Number(item.variance) === 0) return false;
    return true;
  });

  const totalItems = detail.items.length;
  const varianceCount = detail.items.filter((i) => Number(i.variance) !== 0).length;
  const totalVarianceQty = detail.items.reduce((s, i) => s + Number(i.variance), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock Count Detail</DialogTitle>
          <DialogDescription>{detail.referenceNumber}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="font-mono text-sm font-medium">{detail.referenceNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="text-sm font-medium">{detail.location.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={cfg.variant} className="mt-0.5 text-[10px]">{cfg.label}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created By</p>
              <p className="text-sm">{detail.createdBy.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created At</p>
              <p className="text-sm">{formatDateTime(detail.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Frozen At</p>
              <p className="text-sm">{formatDateTime(detail.frozenAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reviewed By</p>
              <p className="text-sm">{detail.reviewedBy?.name || "-"}</p>
            </div>
            {detail.postedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Posted At</p>
                <p className="text-sm">{formatDateTime(detail.postedAt)}</p>
              </div>
            )}
          </div>

          {detail.notes && (
            <>
              <Separator />
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Notes</p>
                <p className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{detail.notes}</p>
              </div>
            </>
          )}

          <Separator />

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Items</p>
              <p className="mt-1 text-xl font-semibold">{totalItems}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Items with Variance</p>
              <p className={cn("mt-1 text-xl font-semibold", varianceCount > 0 ? "text-amber-600" : "text-green-600")}>
                {varianceCount}
              </p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Variance Qty</p>
              <p className={cn("mt-1 text-xl font-semibold", totalVarianceQty !== 0 ? "text-amber-600" : "text-green-600")}>
                {totalVarianceQty > 0 ? "+" : ""}{totalVarianceQty}
              </p>
            </Card>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8 w-64"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyVariances}
                  onChange={(e) => setOnlyVariances(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Only show variances
              </label>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Expected Qty</TableHead>
                <TableHead className="text-right">Counted Qty</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="w-20">Diff</TableHead>
                {canEdit && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 6 : 5}
                    className="py-4 text-center text-sm text-muted-foreground"
                  >
                    {search || onlyVariances ? "No items match your filters" : "No items"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const variance = Number(item.variance);
                  const isEditing = editingId === item.id;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{item.product.name}</p>
                        {item.product.sku && (
                          <p className="font-mono text-xs text-muted-foreground">{item.product.sku}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(item.expectedQty)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={editValues[item.id] ?? ""}
                              onChange={(e) =>
                                setEditValues((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              className="h-7 w-20 text-xs text-right"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-green-600"
                              onClick={() => saveEdit(item.id)}
                              disabled={savingItem === item.id}
                            >
                              {savingItem === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={cancelEdit}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              canEdit && "cursor-pointer hover:text-primary",
                            )}
                            onClick={() => canEdit && startEdit(item.id, Number(item.countedQty))}
                          >
                            {Number(item.countedQty)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        <span className={variance !== 0 ? "text-amber-600" : ""}>
                          {variance > 0 ? "+" : ""}{variance}
                        </span>
                      </TableCell>
                      <TableCell>
                        {variance === 0 ? (
                          <Badge variant="success" className="text-[10px]">Match</Badge>
                        ) : variance > 0 ? (
                          <Badge variant="warning" className="text-[10px]">Surplus</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Short</Badge>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          {!isEditing && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => startEdit(item.id, Number(item.countedQty))}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="flex gap-1">
              {canReview && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleReview}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Review
                </Button>
              )}
              {canPost && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePost}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Post
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
