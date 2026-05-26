"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";
import { useToast } from "@/providers/toast-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function AccountingReportsClient() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("aging");
  const [reportType, setReportType] = useState("RECEIVABLE");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [agingData, setAgingData] = useState<any>(null);
  const [collectionData, setCollectionData] = useState<any>(null);
  const [outstandingData, setOutstandingData] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "aging") fetchAgingReport();
    else if (activeTab === "collection") fetchCollectionReport();
    else if (activeTab === "outstanding") fetchOutstandingReport();
    else if (activeTab === "history") fetchPaymentHistory();
  }, [activeTab, reportType, dateFrom, dateTo]);

  const emptySummary = {
    totalCurrent: 0,
    total1to30: 0,
    total31to60: 0,
    total61to90: 0,
    total90plus: 0,
    totalOverdue: 0,
  };

  const normalizeAgingData = (payload: any) => {
    const rows = (payload?.rows ?? payload?.agingData ?? payload?.data ?? []).map((row: any) => ({
      entity:
        row.entity ||
        row.customer?.companyName ||
        row.customer?.name ||
        row.supplier?.companyName ||
        row.supplier?.name ||
        "Unknown",
      current: Number(row.current || 0),
      days1to30: Number(row.days1to30 || 0),
      days31to60: Number(row.days31to60 || 0),
      days61to90: Number(row.days61to90 || 0),
      days90plus: Number(row.days90plus || 0),
      totalDue: Number(row.totalDue || row.totalOutstanding || 0),
    }));
    const summary =
      payload?.summary ??
      rows.reduce(
        (acc: any, row: any) => ({
          totalCurrent: acc.totalCurrent + Number(row.current || 0),
          total1to30: acc.total1to30 + Number(row.days1to30 || 0),
          total31to60: acc.total31to60 + Number(row.days31to60 || 0),
          total61to90: acc.total61to90 + Number(row.days61to90 || 0),
          total90plus: acc.total90plus + Number(row.days90plus || 0),
          totalOverdue:
            acc.totalOverdue + Math.max(0, Number(row.totalDue || 0) - Number(row.current || 0)),
        }),
        emptySummary,
      );
    return { rows, summary: { ...emptySummary, ...summary } };
  };

  const normalizeCollections = (payload: any) => ({
    rows: (payload?.rows ?? payload?.payments ?? []).map((payment: any) => ({
      date: payment.date || payment.paymentDate,
      entity:
        payment.entity ||
        payment.customer?.companyName ||
        payment.customer?.name ||
        payment.supplier?.companyName ||
        payment.supplier?.name ||
        "-",
      amount: Number(payment.amount || 0),
      method: payment.method || payment.paymentMethod || "-",
      reference: payment.reference || payment.allocations?.[0]?.sale?.invoiceNumber || "-",
    })),
    dailyData: payload?.dailyData ?? payload?.dailyCollection ?? [],
    totalCollected: Number(payload?.totalCollected || 0),
    totalTransactions: Number(payload?.totalTransactions || 0),
  });

  const normalizeOutstanding = (payload: any) => {
    const rows = (payload?.rows ?? payload?.data ?? []).map((row: any) => ({
      name: row.name || row.customer?.name || row.supplier?.name || "Unknown",
      totalDue: Number(row.totalDue ?? row.totalOutstanding ?? 0),
      totalPaid: Number(row.totalPaid || 0),
      totalInvoiced: Number(row.totalInvoiced ?? row.totalPurchased ?? 0),
      documentCount: Number(row.invoiceCount ?? row.purchaseCount ?? 0),
    }));
    return { rows };
  };

  const normalizePaymentHistory = (payload: any) => {
    const rows = (payload?.rows ?? payload?.data ?? []).map((payment: any) => ({
      date: payment.date || payment.paymentDate,
      entity: payment.entity || payment.customer?.name || payment.supplier?.name || "-",
      type: payment.type || (payment.customerId ? "RECEIVED" : "PAID"),
      amount: Number(payment.amount || 0),
      method: payment.method || payment.paymentMethod || "-",
      reference: payment.reference || "",
    }));
    return { rows };
  };

  const fetchAgingReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting/reports/aging?type=${reportType}`).then((r) =>
        r.json(),
      );
      if (res.success) setAgingData(normalizeAgingData(res.data));
      else addToast({ title: res.error || "Failed to load aging report", variant: "error" });
    } catch {
      addToast({ title: "Failed to load aging report", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCollectionReport = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      const res = await fetch(`/api/accounting/reports/collections?${params}`).then((r) =>
        r.json(),
      );
      if (res.success) setCollectionData(normalizeCollections(res.data));
      else addToast({ title: res.error || "Failed to load collections", variant: "error" });
    } catch {
      addToast({ title: "Failed to load collections", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchOutstandingReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/accounting/reports/outstanding?type=${reportType === "RECEIVABLE" ? "CUSTOMER" : "SUPPLIER"}`,
      ).then((r) => r.json());
      if (res.success) setOutstandingData(normalizeOutstanding(res.data));
      else addToast({ title: res.error || "Failed to load outstanding report", variant: "error" });
    } catch {
      addToast({ title: "Failed to load outstanding report", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      const res = await fetch(`/api/accounting/reports/payments?${params}`).then((r) => r.json());
      if (res.success) setPaymentHistory(normalizePaymentHistory(res.data));
      else addToast({ title: res.error || "Failed to load payment history", variant: "error" });
    } catch {
      addToast({ title: "Failed to load payment history", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const COLORS = {
    current: "#10b981",
    days1to30: "#f59e0b",
    days31to60: "#f97316",
    days61to90: "#ef4444",
    days90plus: "#991b1b",
  };

  const exportColumnsAging = [
    { key: "entity", label: "Entity" },
    { key: "current", label: "Current" },
    { key: "days1to30", label: "1-30 Days" },
    { key: "days31to60", label: "31-60 Days" },
    { key: "days61to90", label: "61-90 Days" },
    { key: "days90plus", label: "90+ Days" },
    { key: "totalDue", label: "Total Due" },
  ] as ExportColumn[];

  const exportAgingReport = () => {
    if (!agingData) return;
    exportToCSV(agingData.rows || [], exportColumnsAging, `aging-report-${Date.now()}`);
    addToast({ title: "Exported", variant: "success" });
  };

  const exportCollectionReport = () => {
    if (!collectionData) return;
    exportToCSV(
      collectionData.rows || [],
      [
        { key: "date", label: "Date" },
        { key: "amount", label: "Amount" },
      ],
      `collections-${Date.now()}`,
    );
    addToast({ title: "Exported", variant: "success" });
  };

  const exportOutstandingReport = () => {
    if (!outstandingData) return;
    exportToCSV(
      outstandingData.rows || [],
      [
        { key: "name", label: "Name" },
        { key: "totalDue", label: "Total Due" },
      ],
      `outstanding-${Date.now()}`,
    );
    addToast({ title: "Exported", variant: "success" });
  };

  const exportPaymentHistory = () => {
    if (!paymentHistory) return;
    exportToCSV(
      paymentHistory.rows || [],
      [
        { key: "date", label: "Date" },
        { key: "entity", label: "Entity" },
        { key: "type", label: "Type" },
        { key: "amount", label: "Amount" },
        { key: "method", label: "Method" },
        { key: "reference", label: "Reference" },
      ],
      `payment-history-${Date.now()}`,
    );
    addToast({ title: "Exported", variant: "success" });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Accounting Reports" description="Generate and export accounting reports" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="aging">Aging Report</TabsTrigger>
          <TabsTrigger value="collection">Collections</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        {loading && (
          <div className="rounded-lg border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
            Loading report data...
          </div>
        )}

        <TabsContent value="aging" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Label>Aging Type</Label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm sm:w-auto"
            >
              <option value="RECEIVABLE">Receivables (Customer)</option>
              <option value="PAYABLE">Payables (Supplier)</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={exportAgingReport}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Export
            </Button>
          </div>
          {agingData && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[
                  {
                    label: "Current",
                    value: agingData.summary.totalCurrent,
                    color: "text-emerald-600",
                  },
                  {
                    label: "1-30 Days",
                    value: agingData.summary.total1to30,
                    color: "text-amber-600",
                  },
                  {
                    label: "31-60 Days",
                    value: agingData.summary.total31to60,
                    color: "text-orange-600",
                  },
                  {
                    label: "61-90 Days",
                    value: agingData.summary.total61to90,
                    color: "text-red-600",
                  },
                  {
                    label: "90+ Days",
                    value: agingData.summary.total90plus,
                    color: "text-red-800",
                  },
                  {
                    label: "Total",
                    value: agingData.summary.totalOverdue,
                    color: "text-destructive",
                  },
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
              <Card className="h-72">
                <CardHeader>
                  <CardTitle>Aging Distribution</CardTitle>
                </CardHeader>
                <CardContent className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          name: "Current",
                          value: agingData.summary.totalCurrent,
                          fill: COLORS.current,
                        },
                        {
                          name: "1-30",
                          value: agingData.summary.total1to30,
                          fill: COLORS.days1to30,
                        },
                        {
                          name: "31-60",
                          value: agingData.summary.total31to60,
                          fill: COLORS.days31to60,
                        },
                        {
                          name: "61-90",
                          value: agingData.summary.total61to90,
                          fill: COLORS.days61to90,
                        },
                        {
                          name: "90+",
                          value: agingData.summary.total90plus,
                          fill: COLORS.days90plus,
                        },
                      ]}
                    >
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
                      />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {[
                          {
                            name: "Current",
                            value: agingData.summary.totalCurrent,
                            fill: COLORS.current,
                          },
                          {
                            name: "1-30",
                            value: agingData.summary.total1to30,
                            fill: COLORS.days1to30,
                          },
                          {
                            name: "31-60",
                            value: agingData.summary.total31to60,
                            fill: COLORS.days31to60,
                          },
                          {
                            name: "61-90",
                            value: agingData.summary.total61to90,
                            fill: COLORS.days61to90,
                          },
                          {
                            name: "90+",
                            value: agingData.summary.total90plus,
                            fill: COLORS.days90plus,
                          },
                        ].map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="p-0">
                <div className="max-w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {reportType === "RECEIVABLE" ? "Customer" : "Supplier"}
                        </TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">1-30</TableHead>
                        <TableHead className="text-right">31-60</TableHead>
                        <TableHead className="text-right">61-90</TableHead>
                        <TableHead className="text-right">90+</TableHead>
                        <TableHead className="text-right">Total Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agingData.rows?.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No aging balances found
                          </TableCell>
                        </TableRow>
                      ) : (
                        agingData.rows?.map((row: any, index: number) => (
                          <TableRow key={`${row.entity}-${index}`}>
                            <TableCell className="font-medium">{row.entity}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(row.current)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(row.days1to30)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(row.days31to60)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(row.days61to90)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(row.days90plus)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(row.totalDue)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="collection" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
            <Button variant="outline" size="sm" onClick={exportCollectionReport}>
              <Download className="mr-1 h-3.5 w-3.5" />
              Export
            </Button>
          </div>
          {collectionData && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Collected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">
                      {formatCurrency(collectionData.totalCollected)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{collectionData.totalTransactions}</p>
                  </CardContent>
                </Card>
              </div>
              <Card className="h-72">
                <CardHeader>
                  <CardTitle>Daily Collections</CardTitle>
                </CardHeader>
                <CardContent className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={collectionData.dailyData || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        className="text-xs text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        className="text-xs text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="p-0">
                <div className="max-w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collectionData.rows?.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No collections found
                          </TableCell>
                        </TableRow>
                      ) : (
                        collectionData.rows?.map((row: any, index: number) => (
                          <TableRow key={`${row.reference}-${index}`}>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(row.date)}
                            </TableCell>
                            <TableCell className="font-medium">{row.entity}</TableCell>
                            <TableCell>{row.method}</TableCell>
                            <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(row.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="outstanding" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Label>Outstanding Type</Label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="RECEIVABLE">Customers</option>
              <option value="PAYABLE">Suppliers</option>
            </select>
            <Button variant="outline" size="sm" onClick={exportOutstandingReport}>
              <Download className="mr-1 h-3.5 w-3.5" />
              Export
            </Button>
          </div>
          {outstandingData && (
            <Card className="p-0">
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{reportType === "RECEIVABLE" ? "Customer" : "Supplier"}</TableHead>
                      <TableHead className="text-right">Documents</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outstandingData.rows?.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          No outstanding {reportType === "RECEIVABLE" ? "receivables" : "payables"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      outstandingData.rows?.map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-right">{r.documentCount}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(r.totalInvoiced)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(r.totalPaid)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(r.totalDue)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
            <Button variant="outline" size="sm" onClick={exportPaymentHistory}>
              <Download className="mr-1 h-3.5 w-3.5" />
              Export
            </Button>
          </div>
          {paymentHistory && (
            <Card className="p-0">
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.rows?.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          No payment history found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paymentHistory.rows?.map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(r.date)}
                          </TableCell>
                          <TableCell className="font-medium">{r.entity}</TableCell>
                          <TableCell>
                            <Badge variant={r.type === "RECEIVED" ? "success" : "destructive"}>
                              {r.type}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${r.type === "RECEIVED" ? "text-green-600" : "text-red-600"}`}
                          >
                            {formatCurrency(r.amount)}
                          </TableCell>
                          <TableCell className="text-sm">{r.method}</TableCell>
                          <TableCell className="font-mono text-xs">{r.reference || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
