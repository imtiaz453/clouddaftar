"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";

interface LedgerEntry {
  id: string; movementType: string; quantity: number;
  qtyOnHandBefore: number; qtyOnHandAfter: number;
  qtyReservedBefore: number; qtyReservedAfter: number;
  reference: string | null; referenceId: string | null;
  notes: string | null; createdAt: string;
  product: { id: string; name: string; sku: string | null };
  location: { id: string; name: string };
  createdBy: { id: string; name: string; email: string } | null;
}

interface LocationOption {
  id: string; name: string;
}

const movementTypes = [
  "OPENING_BALANCE", "PURCHASE_RECEIVE", "PURCHASE_RETURN",
  "SALE", "SALE_RETURN", "TRANSFER_IN", "TRANSFER_OUT",
  "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "RESERVATION",
  "RESERVATION_RELEASE", "WRITE_OFF",
];

const movementLabels: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance", PURCHASE_RECEIVE: "Purchase Receive",
  PURCHASE_RETURN: "Purchase Return", SALE: "Sale", SALE_RETURN: "Sale Return",
  TRANSFER_IN: "Transfer In", TRANSFER_OUT: "Transfer Out",
  ADJUSTMENT_IN: "Adjustment In", ADJUSTMENT_OUT: "Adjustment Out",
  RESERVATION: "Reservation", RESERVATION_RELEASE: "Reservation Release",
  WRITE_OFF: "Write Off",
};

interface LedgerClientProps {
  initialData: { data: LedgerEntry[]; total: number; page: number; pageSize: number; totalPages: number };
  locations: LocationOption[];
  movementTypeOptions: string[];
}

export function LedgerClient({ initialData, locations, movementTypeOptions }: LedgerClientProps) {
  const { addToast } = useToast();

  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [movementType, setMovementType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reference, setReference] = useState("");

  const [productResults, setProductResults] = useState<Array<{ id: string; name: string; sku: string | null }>>([]);
  const [productOpen, setProductOpen] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  useEffect(() => {
    if (!productSearch.trim()) { setProductResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/inventory?search=${encodeURIComponent(productSearch)}&pageSize=20`);
        const d = await res.json();
        if (d.success) setProductResults(d.data.data.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku })));
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (productId) params.set("productId", productId);
      if (locationId) params.set("locationId", locationId);
      if (movementType) params.set("movementType", movementType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (reference) params.set("reference", reference);
      params.set("page", String(p));
      params.set("pageSize", "50");

      const res = await fetch(`/api/inventory/ledger-v2?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      addToast({ title: "Failed to load ledger", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [productId, locationId, movementType, dateFrom, dateTo, reference, addToast]);

  function applyFilters() {
    setPage(1);
    fetchData(1);
  }

  function clearFilters() {
    setProductId(""); setProductSearch(""); setLocationId("");
    setMovementType(""); setDateFrom(""); setDateTo(""); setReference("");
    setPage(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchData(newPage);
  }

  const hasFilters = productId || locationId || movementType || dateFrom || dateTo || reference;

  return (
    <div className="space-y-5">
      <PageHeader title="Stock Ledger" description="Complete audit trail of all stock movements" />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="relative flex-1" ref={productRef as any}>
            <p className="mb-1 text-xs text-muted-foreground">Product</p>
            <Input
              placeholder="Search product..."
              value={productSearch}
              onChange={(e) => { setProductSearch(e.target.value); setProductOpen(true); }}
              onFocus={() => setProductOpen(true)}
            />
            {productOpen && productResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border bg-background shadow-lg">
                {productResults.map((p) => (
                  <button key={p.id} type="button"
                    onClick={() => { setProductId(p.id); setProductSearch(p.name); setProductOpen(false); }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent">
                    {p.name} {p.sku && <span className="text-muted-foreground">({p.sku})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Location</p>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All locations" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Movement Type</p>
            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {movementTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>{movementLabels[t] || t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">From</p>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">To</p>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Reference</p>
            <Input placeholder="Invoice/PO #" value={reference} onChange={(e) => setReference(e.target.value)} className="w-[150px]" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={applyFilters}>Search</Button>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <X className="mr-1 h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-4"><TableSkeleton /></div>
        ) : data.data.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No ledger entries found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>On Hand Before</TableHead>
                  <TableHead>On Hand After</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(entry.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                        {movementLabels[entry.movementType] || entry.movementType.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{entry.product.name}</p>
                        {entry.product.sku && <p className="text-xs text-muted-foreground">{entry.product.sku}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{entry.location.name}</TableCell>
                    <TableCell className="font-medium">{Number(entry.quantity)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{Number(entry.qtyOnHandBefore)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{Number(entry.qtyOnHandAfter)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                      {entry.reference || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.createdBy?.name || entry.createdBy?.email || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => handlePageChange(page - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages || loading} onClick={() => handlePageChange(page + 1)}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
