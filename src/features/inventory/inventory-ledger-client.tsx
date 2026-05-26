"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { exportToCSV, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LogEntry {
  id: string;
  type: string;
  quantity: number;
  beforeStock: number;
  afterStock: number;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
  product: { id: string; name: string; sku: string | null; unit: string | null };
  warehouse?: { id: string; name: string; code: string } | null;
  branch?: { id: string; name: string; code: string } | null;
  lot?: { id: string; lotNumber: string; serialNumber: string | null } | null;
  serialNumber?: string | null;
  createdBy?: { id: string; name: string | null } | null;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
}

interface InventoryLedgerClientProps {
  initialData: {
    data: LogEntry[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  products?: ProductOption[];
}

const typeVariants: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  SALE: "destructive",
  PURCHASE: "success",
  ADJUSTMENT: "secondary",
  RETURN: "warning",
  DAMAGE: "destructive",
  LOST: "outline",
  FOUND: "default",
  TRANSFER_OUT: "warning",
  TRANSFER_IN: "default",
};

const typeLabels: Record<string, string> = {
  SALE: "Sale",
  PURCHASE: "Purchase",
  ADJUSTMENT: "Adjustment",
  RETURN: "Return",
  DAMAGE: "Damage",
  LOST: "Lost",
  FOUND: "Found",
  TRANSFER_OUT: "Transfer Out",
  TRANSFER_IN: "Transfer In",
};
const ledgerTypeOptions = Object.entries(typeLabels);

export function InventoryLedgerClient({ initialData }: InventoryLedgerClientProps) {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (productRef.current && !productRef.current.contains(e.target as Node)) {
        setProductOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = productSearch.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/inventory?search=${encodeURIComponent(q)}&pageSize=30`);
        if (res.ok) {
          const d = await res.json();
          if (d.success)
            setSearchResults(
              d.data.data.map((p: ProductOption) => ({ id: p.id, name: p.name, sku: p.sku })),
            );
        }
      } catch {
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [productSearch]);

  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  function handleExport(format: "csv" | "excel") {
    const columns: ExportColumn[] = [
      { key: "date", label: "Date/Time" },
      { key: "product", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "type", label: "Type" },
      { key: "beforeStock", label: "Before" },
      { key: "quantity", label: "Qty" },
      { key: "afterStock", label: "After" },
      { key: "warehouse", label: "Warehouse" },
      { key: "traceability", label: "Lot / Serial" },
      { key: "reference", label: "Reference" },
      { key: "createdBy", label: "Created By" },
      { key: "notes", label: "Notes" },
    ];
    const rows = data.data.map((e) => ({
      date: formatDateTime(e.createdAt),
      product: e.product.name,
      sku: e.product.sku || "",
      type: typeLabels[e.type] || e.type,
      beforeStock: e.beforeStock,
      quantity: e.quantity > 0 ? `+${e.quantity}` : String(e.quantity),
      afterStock: e.afterStock,
      warehouse: e.warehouse ? `${e.warehouse.code} - ${e.warehouse.name}` : "",
      traceability: e.lot?.serialNumber || e.serialNumber || e.lot?.lotNumber || "",
      reference: e.reference || "",
      createdBy: e.createdBy?.name || "",
      notes: e.notes || "",
    }));
    const fn = `inventory-ledger-${Date.now()}`;
    if (format === "csv") exportToCSV(rows, columns, fn);
    else exportToExcel(rows, columns, fn);
  }

  const loadPage = useCallback(
    async (newPage: number) => {
      setPage(newPage);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (typeFilter) params.set("type", typeFilter);
        if (productId) params.set("productId", productId);
        params.set("page", newPage.toString());
        params.set("pageSize", "50");
        const res = await fetch(`/api/inventory/ledger?${params}`);
        if (res.ok) {
          const d = await res.json();
          if (d.success) setData(d.data);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    },
    [dateFrom, dateTo, typeFilter, productId],
  );

  const handleFilter = () => {
    setPage(1);
    loadPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative" ref={productRef}>
          <Label className="text-xs">Product</Label>
          <Input
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value);
              setProductOpen(true);
            }}
            onFocus={() => {
              if (productSearch) setProductOpen(true);
            }}
            placeholder={
              (productId && searchResults.find((p) => p.id === productId)?.name) || "All Products"
            }
            className="h-8 w-56"
          />
          {productId && !productOpen && (
            <button
              onClick={() => {
                setProductId("");
                setProductSearch("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              title="Clear filter"
            >
              x
            </button>
          )}
          {productOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-auto rounded-md border bg-background shadow-lg">
              {searching ? (
                <div className="p-2 text-sm text-muted-foreground">Searching...</div>
              ) : productSearch && searchResults.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No products found</div>
              ) : (
                <>
                  {(productId || !productSearch) && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                      onClick={() => {
                        setProductId("");
                        setProductSearch("");
                        setProductOpen(false);
                      }}
                    >
                      {productSearch ? `All matching products` : "All Products"}
                    </button>
                  )}
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted ${p.id === productId ? "bg-muted font-medium" : ""}`}
                      onClick={() => {
                        setProductId(p.id);
                        setProductSearch("");
                        setProductOpen(false);
                      }}
                    >
                      <span className="truncate">{p.name}</span>
                      {p.sku && (
                        <span className="shrink-0 text-xs text-muted-foreground">{p.sku}</span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Select
            value={typeFilter || "all"}
            onValueChange={(value) => setTypeFilter(value === "all" ? "" : value)}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ledgerTypeOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8"
          />
        </div>
        <Button size="sm" onClick={handleFilter}>
          Filter
        </Button>
        <div className="ml-auto flex gap-1">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
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
              {data.data.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No inventory movements found
                </div>
              ) : (
                <div className="divide-y">
                  {data.data.map((entry) => (
                    <div key={entry.id} className="space-y-1.5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </span>
                        <Badge
                          variant={typeVariants[entry.type] || "secondary"}
                          className="shrink-0 text-xs"
                        >
                          {typeLabels[entry.type] || entry.type}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{entry.product.name}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>SKU: {entry.product.sku || "-"}</span>
                        <span>
                          Stock: {entry.beforeStock} →{" "}
                          <span
                            className={
                              entry.quantity > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"
                            }
                          >
                            {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                          </span>{" "}
                          → {entry.afterStock}
                        </span>
                        <span>
                          WH:{" "}
                          {entry.warehouse
                            ? `${entry.warehouse.code}`
                            : entry.branch
                              ? `${entry.branch.code}`
                              : "-"}
                        </span>
                        <span>
                          Lot/Serial:{" "}
                          {entry.lot?.serialNumber ||
                            entry.serialNumber ||
                            entry.lot?.lotNumber ||
                            "-"}
                        </span>
                        <span>
                          Ref:{" "}
                          {(entry.type === "TRANSFER_OUT" || entry.type === "TRANSFER_IN") &&
                          entry.reference ? (
                            <button
                              onClick={() =>
                                window.open(
                                  `/api/transfers/${entry.reference}?print=1`,
                                  "_blank",
                                  "width=800,height=700",
                                )
                              }
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              {entry.reference}
                              <Printer className="h-3 w-3" />
                            </button>
                          ) : (
                            entry.reference || "-"
                          )}
                        </span>
                        <span>By: {entry.createdBy?.name || "-"}</span>
                      </div>
                      {entry.notes && (
                        <p className="truncate text-xs text-muted-foreground">
                          Notes: {entry.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Lot / Serial</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={12}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No inventory movements found
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.data.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{entry.product.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {entry.product.sku || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={typeVariants[entry.type] || "secondary"}
                            className="text-xs"
                          >
                            {typeLabels[entry.type] || entry.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{entry.beforeStock}</TableCell>
                        <TableCell
                          className={`text-right text-sm font-medium ${entry.quantity > 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                        </TableCell>
                        <TableCell className="text-right text-sm">{entry.afterStock}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.warehouse
                            ? `${entry.warehouse.code} - ${entry.warehouse.name}`
                            : entry.branch
                              ? `${entry.branch.code} - ${entry.branch.name}`
                              : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {entry.lot?.serialNumber ||
                            entry.serialNumber ||
                            entry.lot?.lotNumber ||
                            "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {(entry.type === "TRANSFER_OUT" || entry.type === "TRANSFER_IN") &&
                          entry.reference ? (
                            <div className="flex items-center gap-2">
                              <span>{entry.reference}</span>
                              <button
                                onClick={() =>
                                  window.open(
                                    `/api/transfers/${entry.reference}?print=1`,
                                    "_blank",
                                    "width=800,height=700",
                                  )
                                }
                                className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Print transfer"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            entry.reference || "-"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.createdBy?.name || "-"}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                          {entry.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">{data.total} total movements</p>
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
                  disabled={data.data.length < 50}
                  onClick={() => loadPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
