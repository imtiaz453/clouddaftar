"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/providers/toast-provider";
import { formatCurrency } from "@/lib/utils";
import { getCustomerAging } from "@/actions/accounting";
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

interface CustomerAgingSummary {
  totalCurrent: number;
  total1to30: number;
  total31to60: number;
  total61to90: number;
  total90plus: number;
  totalOverdue: number;
}

interface CustomerAgingRecord {
  customer: { id: string; name: string; email: string | null; phone: string | null };
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  totalDue: number;
}

interface CustomerAgingData {
  agingData: CustomerAgingRecord[];
  summary: CustomerAgingSummary;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface CustomerAgingClientProps {
  initialData: CustomerAgingData;
}

const AGE_BUCKETS = [
  {
    key: "current" as const,
    label: "Current",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  {
    key: "days1to30" as const,
    label: "1-30 Days",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  {
    key: "days31to60" as const,
    label: "31-60 Days",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  {
    key: "days61to90" as const,
    label: "61-90 Days",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  {
    key: "days90plus" as const,
    label: "90+ Days",
    color: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300",
  },
];

const CHART_COLORS = ["#22c55e", "#f59e0b", "#f97316", "#ef4444", "#dc2626"];

function getAgeColorClass(bucketLabel: string): string {
  switch (bucketLabel) {
    case "Current":
      return "text-green-600";
    case "1-30 Days":
      return "text-amber-600";
    case "31-60 Days":
      return "text-orange-600";
    case "61-90 Days":
      return "text-red-600";
    case "90+ Days":
      return "text-red-800 dark:text-red-400";
    default:
      return "";
  }
}

export function CustomerAgingClient({ initialData }: CustomerAgingClientProps) {
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
        const result = await getCustomerAging({
          search: searchTerm || undefined,
          page: pageNum,
          pageSize: 20,
        });
        setData(result as CustomerAgingData);
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

  const summaryCards = [
    { label: "Current", value: data.summary.totalCurrent, color: "green" },
    { label: "1-30 Days", value: data.summary.total1to30, color: "amber" },
    { label: "31-60 Days", value: data.summary.total31to60, color: "orange" },
    { label: "61-90 Days", value: data.summary.total61to90, color: "red" },
    { label: "90+ Days", value: data.summary.total90plus, color: "darkred" },
    { label: "Total Overdue", value: data.summary.totalOverdue, color: "destructive" },
  ];

  const chartData = AGE_BUCKETS.map((bucket, i) => ({
    name: bucket.label,
    amount:
      bucket.key === "current"
        ? data.summary.totalCurrent
        : bucket.key === "days1to30"
          ? data.summary.total1to30
          : bucket.key === "days31to60"
            ? data.summary.total31to60
            : bucket.key === "days61to90"
              ? data.summary.total61to90
              : data.summary.total90plus,
    color: CHART_COLORS[i],
  }));

  const highRiskCustomers = data.agingData.filter((r) => r.days90plus > 0);

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
      <PageHeader title="Customer Aging" description="Aging analysis of customer receivables" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summaryCards.map((card) => {
          const colorMap: Record<string, string> = {
            green:
              "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 text-green-700 dark:text-green-300",
            amber:
              "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
            orange:
              "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950 text-orange-700 dark:text-orange-300",
            red: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 text-red-700 dark:text-red-300",
            darkred:
              "border-red-300 bg-red-100 dark:border-red-900 dark:bg-red-950 text-red-800 dark:text-red-300",
            destructive:
              "border-red-400 bg-red-100 dark:border-red-900 dark:bg-red-950 text-red-800 dark:text-red-200",
          };
          return (
            <Card key={card.label} className={colorMap[card.color] || ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium opacity-80">{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-base font-bold sm:text-lg">{formatCurrency(card.value)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aging Distribution</CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  className="text-xs text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 11 }} className="text-xs text-muted-foreground" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Aging Details</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search customer..."
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
                title={search ? "No matching customers" : "No aging data"}
                description={search ? "Try a different search term" : "All invoices are paid"}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    {AGE_BUCKETS.map((bucket) => (
                      <TableHead key={bucket.key} className="text-right">
                        {bucket.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold">Total Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agingData.map((record) => (
                    <TableRow key={record.customer.id}>
                      <TableCell className="font-medium">{record.customer.name}</TableCell>
                      <TableCell
                        className={`text-right ${record.current > 0 ? getAgeColorClass("Current") : ""}`}
                      >
                        {record.current > 0 ? formatCurrency(record.current) : "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right ${record.days1to30 > 0 ? getAgeColorClass("1-30 Days") : ""}`}
                      >
                        {record.days1to30 > 0 ? formatCurrency(record.days1to30) : "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right ${record.days31to60 > 0 ? getAgeColorClass("31-60 Days") : ""}`}
                      >
                        {record.days31to60 > 0 ? formatCurrency(record.days31to60) : "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right ${record.days61to90 > 0 ? getAgeColorClass("61-90 Days") : ""}`}
                      >
                        {record.days61to90 > 0 ? formatCurrency(record.days61to90) : "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${record.days90plus > 0 ? getAgeColorClass("90+ Days") : ""}`}
                      >
                        {record.days90plus > 0 ? formatCurrency(record.days90plus) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(record.totalDue)}
                      </TableCell>
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

      {highRiskCustomers.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="bg-red-50 dark:bg-red-950">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-800 dark:text-red-200">
                High-Risk Customers (90+ Days)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead className="text-right">90+ Days</TableHead>
                  <TableHead className="text-right">Total Due</TableHead>
                  <TableHead>Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highRiskCustomers.map((record) => (
                  <TableRow key={record.customer.id}>
                    <TableCell className="font-medium text-red-700 dark:text-red-300">
                      {record.customer.name}
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {formatCurrency(record.days90plus)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(record.totalDue)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {record.customer.email || record.customer.phone || "-"}
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
