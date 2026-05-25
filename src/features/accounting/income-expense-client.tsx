"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Download } from "lucide-react";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

interface IncomeExpenseClientProps {
  initialData: {
    monthly: MonthlyData[];
    summary: { totalIncome: number; totalExpense: number; netProfit: number };
    paymentMethodIncome: Record<string, number>;
    paymentMethodExpense: Record<string, number>;
    year: number;
  };
}

const paymentLabels: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  EASYPAISA: "Easypaisa",
  JAZZCASH: "JazzCash",
  ONLINE_TRANSFER: "Online Transfer",
};

export function IncomeExpenseClient({ initialData }: IncomeExpenseClientProps) {
  const [data, setData] = useState(initialData);
  const [year, setYear] = useState(initialData.year);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(initialData);
    setYear(initialData.year);
  }, [initialData]);

  function exportCSV() {
    const columns: ExportColumn[] = [
      { key: "month", label: "Month" },
      { key: "income", label: "Income" },
      { key: "expense", label: "Expense" },
      { key: "profit", label: "Profit/Loss" },
    ];
    const rows = monthly.map((m) => ({
      month: m.month,
      income: m.income,
      expense: m.expense,
      profit: m.income - m.expense,
    }));
    exportToCSV(rows, columns, `income-expense-${year}`);
  }

  const loadYear = async (newYear: number) => {
    setYear(newYear);
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting/income-expense?year=${newYear}`);
      if (res.ok) {
        const d = await res.json();
        if (d.success) setData(d.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const { summary, monthly, paymentMethodIncome, paymentMethodExpense } = data;
  const allMethods = new Set([
    ...Object.keys(paymentMethodIncome),
    ...Object.keys(paymentMethodExpense),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Label className="text-xs">Year</Label>
        <select
          value={year}
          onChange={(e) => loadYear(parseInt(e.target.value))}
          className="flex h-8 w-[120px] rounded-md border border-input bg-background px-3 text-xs"
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={exportCSV} className="ml-auto">
          <Download className="mr-1 h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Total Income
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Total Expense
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Net Profit / Loss
            </CardTitle>
            <PiggyBank
              className={`h-4 w-4 ${summary.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}
            />
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${summary.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatCurrency(Math.abs(summary.netProfit))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Profit Margin
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {summary.totalIncome > 0
                ? `${((summary.netProfit / summary.totalIncome) * 100).toFixed(1)}%`
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Income vs Expense</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income by Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(allMethods).map((method) => {
                const val = paymentMethodIncome[method] || 0;
                const pct = summary.totalIncome > 0 ? (val / summary.totalIncome) * 100 : 0;
                return (
                  <div key={method} className="flex items-center justify-between text-sm">
                    <span>{paymentLabels[method] || method}</span>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-24 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-green-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-24 text-right font-medium">{formatCurrency(val)}</span>
                    </div>
                  </div>
                );
              })}
              {Array.from(allMethods).length === 0 && (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense by Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(allMethods).map((method) => {
                const val = paymentMethodExpense[method] || 0;
                const pct = summary.totalExpense > 0 ? (val / summary.totalExpense) * 100 : 0;
                return (
                  <div key={method} className="flex items-center justify-between text-sm">
                    <span>{paymentLabels[method] || method}</span>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-24 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-red-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-24 text-right font-medium">{formatCurrency(val)}</span>
                    </div>
                  </div>
                );
              })}
              {Array.from(allMethods).length === 0 && (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
