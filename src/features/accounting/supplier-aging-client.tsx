"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Building2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/providers/toast-provider";
import { getSupplierAging } from "@/actions/accounting";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SupplierAgingRow {
  supplierId: string;
  supplierName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  totalDue: number;
}

interface SupplierAgingData {
  agingData: SupplierAgingRow[];
  summary: {
    totalCurrent: number;
    total1to30: number;
    total31to60: number;
    total61to90: number;
    total90plus: number;
    totalOverdue: number;
  };
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Props {
  initialData: SupplierAgingData;
}

const COLORS = {
  current: "#10b981",
  days1to30: "#f59e0b",
  days31to60: "#f97316",
  days61to90: "#ef4444",
  days90plus: "#991b1b",
};

const AGE_BUCKETS = [
  { key: "current" as const, label: "Current", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { key: "days1to30" as const, label: "1-30 Days", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { key: "days31to60" as const, label: "31-60 Days", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { key: "days61to90" as const, label: "61-90 Days", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { key: "days90plus" as const, label: "90+ Days", color: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300" },
];

function getAgeColorClass(bucketLabel: string): string {
  switch (bucketLabel) {
    case "Current": return "text-green-600";
    case "1-30 Days": return "text-amber-600";
    case "31-60 Days": return "text-orange-600";
    case "61-90 Days": return "text-red-600";
    case "90+ Days": return "text-red-800 dark:text-red-400";
    default: return "";
  }
}

export function SupplierAgingClient({ initialData }: Props) {
  const { addToast } = useToast();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  const fetchData = useCallback(
    async (searchTerm: string, pageNum: number) => {
      setLoading(true);
      try {
        const result = await getSupplierAging({
          search: searchTerm || undefined,
          page: pageNum,
          pageSize: 20,
        });
        setData(result as unknown as SupplierAgingData);
      } catch {
        addToast({ title: "Error loading aging data", variant: "error" });
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    fetchData(value, 1);
  }

  function loadPage(newPage: number) {
    setPage(newPage);
    fetchData(search, newPage);
  }

  const agingChart = [
    { name: "Current", value: data.summary.totalCurrent, fill: COLORS.current },
    { name: "1-30 Days", value: data.summary.total1to30, fill: COLORS.days1to30 },
    { name: "31-60 Days", value: data.summary.total31to60, fill: COLORS.days31to60 },
    { name: "61-90 Days", value: data.summary.total61to90, fill: COLORS.days61to90 },
    { name: "90+ Days", value: data.summary.total90plus, fill: COLORS.days90plus },
  ];

  const highRisk = data.agingData.filter((s) => s.days90plus > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-md">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, i: number) => (
            <p key={i} className="text-sm" style={{ color: entry.color }}>
              {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Current", value: data.summary.totalCurrent, color: "text-emerald-600" },
          { label: "1-30 Days", value: data.summary.total1to30, color: "text-amber-600" },
          { label: "31-60 Days", value: data.summary.total31to60, color: "text-orange-600" },
          { label: "61-90 Days", value: data.summary.total61to90, color: "text-red-600" },
          { label: "90+ Days", value: data.summary.total90plus, color: "text-red-800" },
          { label: "Total Overdue", value: data.summary.totalOverdue, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-lg font-bold ${s.color}`}>{formatCurrency(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supplier Aging Distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agingChart}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                className="text-xs text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                className="text-xs text-muted-foreground"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(Number(v))}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {agingChart.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Aging Details</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search supplier..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <TableSkeleton />
            </div>
          ) : data.agingData.length === 0 ? (
            <div className="px-6 py-12">
              <EmptyState
                title={search ? "No matching suppliers" : "No aging data"}
                description={search ? "Try a different search term" : "All invoices are paid"}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    {AGE_BUCKETS.map((bucket) => (
                      <TableHead key={bucket.key} className="text-right">{bucket.label}</TableHead>
                    ))}
                    <TableHead className="text-right font-bold">Total Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agingData.map((row) => (
                    <TableRow key={row.supplierId}>
                      <TableCell className="font-medium">{row.supplierName}</TableCell>
                      <TableCell className={`text-right ${row.current > 0 ? getAgeColorClass("Current") : ""}`}>
                        {row.current > 0 ? formatCurrency(row.current) : "-"}
                      </TableCell>
                      <TableCell className={`text-right ${row.days1to30 > 0 ? getAgeColorClass("1-30 Days") : ""}`}>
                        {row.days1to30 > 0 ? formatCurrency(row.days1to30) : "-"}
                      </TableCell>
                      <TableCell className={`text-right ${row.days31to60 > 0 ? getAgeColorClass("31-60 Days") : ""}`}>
                        {row.days31to60 > 0 ? formatCurrency(row.days31to60) : "-"}
                      </TableCell>
                      <TableCell className={`text-right ${row.days61to90 > 0 ? getAgeColorClass("61-90 Days") : ""}`}>
                        {row.days61to90 > 0 ? formatCurrency(row.days61to90) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${row.days90plus > 0 ? getAgeColorClass("90+ Days") : ""}`}>
                        {row.days90plus > 0 ? formatCurrency(row.days90plus) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(row.totalDue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages} ({data.total} total)
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => loadPage(data.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.totalPages}
                  onClick={() => loadPage(data.page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {highRisk.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="bg-red-50 dark:bg-red-950">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-800 dark:text-red-200">
                Critical Payables (90+ days)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Name</TableHead>
                  <TableHead className="text-right">90+ Days</TableHead>
                  <TableHead className="text-right">Total Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highRisk.map((s) => (
                  <TableRow key={s.supplierId}>
                    <TableCell className="font-medium text-red-700 dark:text-red-300">
                      {s.supplierName}
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {formatCurrency(s.days90plus)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(s.totalDue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
