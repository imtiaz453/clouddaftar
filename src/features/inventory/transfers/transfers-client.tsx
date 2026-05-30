"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Truck,
  CheckCircle,
  XCircle,
  Package,
  Building2,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatDateTime } from "@/lib/utils";
import {
  getStockTransfers,
  issueStockTransferAction,
  receiveStockTransferAction,
  cancelStockTransferAction,
} from "@/actions/inventory";
import { TransferFormDialog } from "./transfer-form-dialog";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "ISSUED", label: "Issued" },
  { value: "PARTIALLY_RECEIVED", label: "Partially Received" },
  { value: "RECEIVED", label: "Received" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_BADGE: Record<string, "warning" | "default" | "success" | "destructive"> = {
  DRAFT: "warning",
  ISSUED: "default",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELLED: "destructive",
};

interface TransferItem {
  id: string;
  quantity: number;
  product: { name: string; sku: string | null };
}

interface Transfer {
  id: string;
  referenceNumber: string;
  status: string;
  sourceLocation: { id: string; name: string; code: string };
  destinationLocation: { id: string; name: string; code: string };
  createdBy: { id: string; name: string | null };
  items: TransferItem[];
  createdAt: string;
  issuedAt: string | null;
  receivedAt: string | null;
}

interface PaginatedResult {
  data: Transfer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface TransfersClientProps {
  initialData: PaginatedResult;
}

export function TransfersClient({ initialData }: TransfersClientProps) {
  const [data, setData] = useState<PaginatedResult>(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  const loadData = useCallback(
    async (params: { status?: string; search?: string; page?: number }) => {
      setLoading(true);
      try {
        const result = (await getStockTransfers({
          status: params.status || undefined,
          page: params.page || 1,
          pageSize: 20,
        })) as unknown as PaginatedResult;
        setData(result);
      } catch (err) {
        toast.error("Failed to load transfers", {
          description: String(err),
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  function handleSearchSubmit() {
    setPage(1);
    loadData({ status: statusFilter, search, page: 1 });
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setPage(1);
    loadData({ status: value, search, page: 1 });
  }

  function goToPage(newPage: number) {
    setPage(newPage);
    loadData({ status: statusFilter, search, page: newPage });
  }

  async function handleIssue(transferId: string) {
    try {
      await issueStockTransferAction(transferId);
      toast.success("Transfer issued");
      loadData({ status: statusFilter, search, page });
    } catch (err) {
      toast.error("Failed to issue transfer", { description: String(err) });
    }
  }

  async function handleReceive(transferId: string) {
    try {
      await receiveStockTransferAction(transferId);
      toast.success("Transfer received");
      loadData({ status: statusFilter, search, page });
    } catch (err) {
      toast.error("Failed to receive transfer", { description: String(err) });
    }
  }

  async function handleCancel(transferId: string) {
    try {
      await cancelStockTransferAction(transferId);
      toast.success("Transfer cancelled");
      loadData({ status: statusFilter, search, page });
    } catch (err) {
      toast.error("Failed to cancel transfer", { description: String(err) });
    }
  }

  const totalQty = (items: TransferItem[]) =>
    items.reduce((sum, i) => sum + Number(i.quantity), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Transfers"
        description="Manage inventory movements between locations"
      >
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Transfer
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.filter((opt) => typeof opt.value === "string" && opt.value.trim() !== "").map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No stock transfers found"
          description="Create a transfer to move stock between locations"
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Transfer
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[70px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/inventory/transfers/${t.id}`}
                        className="hover:text-primary"
                      >
                        {t.referenceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {t.sourceLocation.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {t.destinationLocation.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[t.status] || "default"}>
                        {t.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {t.items.length}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {totalQty(t.items)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.createdBy.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(t.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/inventory/transfers/${t.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {(t.status === "DRAFT" ||
                          t.status === "ISSUED" ||
                          t.status === "PARTIALLY_RECEIVED") && (
                            <div className="relative group">
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                              <div className="absolute right-0 top-full z-50 mt-1 hidden min-w-[160px] rounded-lg border bg-popover p-1 shadow-md group-hover:block">
                                {t.status === "DRAFT" && (
                                  <button
                                    onClick={() => handleIssue(t.id)}
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent"
                                  >
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Issue Transfer
                                  </button>
                                )}
                                {(t.status === "ISSUED" ||
                                  t.status === "PARTIALLY_RECEIVED") && (
                                  <button
                                    onClick={() => handleReceive(t.id)}
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent"
                                  >
                                    <Package className="h-4 w-4 text-blue-500" />
                                    Receive Transfer
                                  </button>
                                )}
                                {(t.status as string) !== "RECEIVED" &&
                                  (t.status as string) !== "CANCELLED" && (
                                    <button
                                      onClick={() => handleCancel(t.id)}
                                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                                    >
                                      <XCircle className="h-4 w-4" />
                                      Cancel Transfer
                                    </button>
                                  )}
                              </div>
                            </div>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {data.data.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/inventory/transfers/${t.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {t.referenceNumber}
                  </Link>
                  <Badge variant={STATUS_BADGE[t.status] || "default"}>
                    {t.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    {t.sourceLocation.name}
                    <span className="text-border">→</span>
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {t.destinationLocation.name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 shrink-0" />
                    {t.items.length} items · {totalQty(t.items)} total qty
                  </div>
                  <div className="text-xs">
                    {t.createdBy.name || "—"} · {formatDateTime(t.createdAt)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/inventory/transfers/${t.id}`}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                    </Link>
                  </Button>
                  {t.status === "DRAFT" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleIssue(t.id)}
                    >
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                      Issue
                    </Button>
                  )}
                  {(t.status === "ISSUED" || t.status === "PARTIALLY_RECEIVED") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReceive(t.id)}
                    >
                      <Package className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
                      Receive
                    </Button>
                  )}
                  {(t.status as string) !== "RECEIVED" && (t.status as string) !== "CANCELLED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(t.id)}
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Page {data.page} of {data.totalPages} ({data.total} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <TransferFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
