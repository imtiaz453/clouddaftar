"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, AlertTriangle, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/search-input";
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
  totalPages: number;
  page: number;
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

export function SupplierAgingClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  const agingChart = [
    { name: "Current", value: data.summary.totalCurrent, fill: COLORS.current },
    { name: "1-30 Days", value: data.summary.total1to30, fill: COLORS.days1to30 },
    { name: "31-60 Days", value: data.summary.total31to60, fill: COLORS.days31to60 },
    { name: "61-90 Days", value: data.summary.total61to90, fill: COLORS.days61to90 },
    { name: "90+ Days", value: data.summary.total90plus, fill: COLORS.days90plus },
  ];

  const highRisk = data.agingData.filter((s) => s.days90plus > 0);

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
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--background))",
                }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {agingChart.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="mb-4">
        <SearchInput placeholder="Search suppliers..." value={search} onChange={setSearch} />
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">1-30 Days</TableHead>
              <TableHead className="text-right">31-60 Days</TableHead>
              <TableHead className="text-right">61-90 Days</TableHead>
              <TableHead className="text-right">90+ Days</TableHead>
              <TableHead className="text-right">Total Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.agingData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No aging data
                </TableCell>
              </TableRow>
            ) : (
              data.agingData.map((row) => (
                <TableRow key={row.supplierId}>
                  <TableCell className="font-medium">{row.supplierName}</TableCell>
                  <TableCell className="text-right text-emerald-600">
                    {row.current > 0 ? formatCurrency(row.current) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-amber-600">
                    {row.days1to30 > 0 ? formatCurrency(row.days1to30) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-orange-600">
                    {row.days31to60 > 0 ? formatCurrency(row.days31to60) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {row.days61to90 > 0 ? formatCurrency(row.days61to90) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-red-800">
                    {row.days90plus > 0 ? formatCurrency(row.days90plus) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(row.totalDue)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {highRisk.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Critical Payables (90+ days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {highRisk.map((s) => (
                <div
                  key={s.supplierId}
                  className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">{s.supplierName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(s.days90plus)} overdue 90+ days
                      </p>
                    </div>
                  </div>
                  <Badge variant="destructive">{formatCurrency(s.totalDue)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
