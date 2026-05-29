"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Truck,
  ArrowRightLeft,
  Package,
  Search,
  Plus,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import { getStockTransfers, getLocationsForSelect } from "@/actions/inventory-new";
import { TransferCreateDialog } from "./transfer-create-dialog";

interface Location {
  id: string;
  name: string;
  code: string;
}

interface TransferItem {
  id: string;
  quantity: number;
  product: { name: string; sku: string | null };
}

interface Transfer {
  id: string;
  referenceNumber: string;
  status: string;
  sourceLocation: Location;
  destinationLocation: Location;
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

interface TransfersListClientProps {
  initialData: PaginatedResult;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  IN_TRANSIT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function TransfersListClient({ initialData }: TransfersListClientProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const { addToast } = useToast();

  const [data, setData] = useState<PaginatedResult>(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    loadLocations();
  }, []);

  async function loadLocations() {
    try {
      const locs = await getLocationsForSelect();
      setLocations(locs as unknown as Location[]);
    } catch {
      // silent
    }
  }

  const loadData = useCallback(
    async (params: { status?: string; search?: string; page?: number }) => {
      setLoading(true);
      try {
        const result: PaginatedResult = await getStockTransfers({
          status: params.status || undefined,
          page: params.page || 1,
          pageSize: 20,
        }) as unknown as PaginatedResult;
        setData(result);
      } catch (err) {
        addToast({
          title: "Failed to load transfers",
          description: String(err),
          variant: "error",
        });
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("status", value);
    else params.delete("status");
    router.push(`${pathname}?${params}`);
    loadData({ status: value, search, page: 1 });
  }

  function handleSearch(value: string) {
    setSearch(value);
  }

  function handleSearchSubmit() {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    params.set("page", "1");
    router.push(`${pathname}?${params}`);
    loadData({ status: statusFilter, search, page: 1 });
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params}`);
    loadData({ status: statusFilter, search, page });
  }

  function viewDetail(id: string) {
    router.push(`${pathname}/${id}`);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Transfers"
        description="Manage inventory movements between locations"
      >
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Transfer
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by reference..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
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
        <Card className="flex flex-col items-center py-12 text-center">
          <Truck className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">No stock transfers found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a transfer to move stock between locations
          </p>
        </Card>
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
                  <TableHead>Items</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => viewDetail(t.id)}
                  >
                    <TableCell className="font-medium">{t.referenceNumber}</TableCell>
                    <TableCell className="text-sm">{t.sourceLocation.name}</TableCell>
                    <TableCell className="text-sm">{t.destinationLocation.name}</TableCell>
                    <TableCell>
                      <Badge
                        className={`border-0 ${STATUS_STYLES[t.status] || ""}`}
                        variant="outline"
                      >
                        {t.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.items.length}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(t.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          viewDetail(t.id);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {data.data.map((t) => (
              <Card
                key={t.id}
                className="cursor-pointer p-4 transition hover:bg-accent/50"
                onClick={() => viewDetail(t.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.referenceNumber}</span>
                  <Badge
                    className={`border-0 ${STATUS_STYLES[t.status] || ""}`}
                    variant="outline"
                  >
                    {t.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{t.sourceLocation.name}</span>
                  <ArrowRightLeft className="h-3 w-3" />
                  <span>{t.destinationLocation.name}</span>
                </div>
                <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {t.items.length} items
                  </span>
                  <span>{formatDate(t.createdAt)}</span>
                </div>
              </Card>
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {data.page} of {data.totalPages} ({data.total} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => goToPage(data.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.totalPages}
                  onClick={() => goToPage(data.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <TransferCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        locations={locations as any}
      />
    </div>
  );
}
