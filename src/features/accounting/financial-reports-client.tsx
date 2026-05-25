"use client";

import { useState, useCallback, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

const ACCOUNT_TYPE_LABELS: Record<string, string> = { ASSET: "Assets", LIABILITY: "Liabilities", EQUITY: "Equity", INCOME: "Income", EXPENSE: "Expenses" };

const TABS = [
  { id: "gl", label: "General Ledger" },
  { id: "trial-balance", label: "Trial Balance" },
  { id: "balance-sheet", label: "Balance Sheet" },
  { id: "profit-loss", label: "Profit & Loss" },
  { id: "day-book", label: "Day Book" },
];

export function FinancialReportsClient({ initialAccounts }: { initialAccounts: { id: string; code: string; name: string; type: string }[] }) {
  const [tab, setTab] = useState("gl");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  function handleTabChange(newTab: string) {
    setTab(newTab);
    setData(null);
  }

  // Filters
  const [accountId, setAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [journalType, setJournalType] = useState("");
  const [glPage, setGlPage] = useState(1);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      let url = `/api/accounting/reports/${tab}`;
      if (tab === "gl") {
        if (accountId) params.set("accountId", accountId);
        params.set("page", String(glPage));
        params.set("pageSize", "50");
      }
      if (tab === "day-book" && journalType) params.set("journalType", journalType);
      const qs = params.toString();
      if (qs) url += `?${qs}`;
      const res = await fetch(url);
      if (res.ok) { const d = await res.json(); if (d.success) setData(d.data); }
    } catch { } finally { setLoading(false); }
  }, [tab, accountId, dateFrom, dateTo, journalType, glPage]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function exportCsv() {
    if (!data) return;
    let rows: string[][] = [];
    if (tab === "gl" && data.data) {
      rows = [["Date", "Number", "Description", "Account", "Debit", "Credit"]];
      data.data.forEach((l: any) => rows.push([formatDate(l.journalEntry.date), l.journalEntry.number, l.journalEntry.description, `${l.account.code} ${l.account.name}`, String(l.debit), String(l.credit)]));
    } else if (tab === "trial-balance" && data.accounts) {
      rows = [["Code", "Account", "Type", "Debit", "Credit", "Balance"]];
      data.accounts.forEach((a: any) => rows.push([a.code, a.name, a.type, String(a.trialDebit || 0), String(a.trialCredit || 0), String(a.balance)]));
    } else if (tab === "balance-sheet") {
      rows = [["Category", "Account", "Balance"]];
      ["assets", "liabilities", "equity"].forEach((cat) => {
        (data[cat] || []).forEach((a: any) => rows.push([cat, a.name, String(a.balance)]));
      });
    } else if (tab === "profit-loss") {
      rows = [["Category", "Account", "Amount"]];
      ["income", "expenses"].forEach((cat) => {
        (data[cat] || []).forEach((a: any) => rows.push([cat, a.name, String(a.balance)]));
      });
    } else if (tab === "day-book") {
      rows = [["Date", "Number", "Description", "Type", "Account", "Debit", "Credit"]];
      (data || []).forEach((e: any) => {
        (e.lines || []).forEach((l: any) => rows.push([formatDate(e.date), e.number, e.description, e.journalType, `${l.account.code} ${l.account.name}`, String(l.debit), String(l.credit)]));
      });
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${tab}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Financial Reports" description="General Ledger, Trial Balance, and Financial Statements">
        <Button variant="outline" onClick={exportCsv} disabled={!data}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2 border-b">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => handleTabChange(t.id)} className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t.label}</button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        {tab === "gl" && (
          <Select value={accountId} onValueChange={(v) => { setAccountId(v); setGlPage(1); }}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All accounts" /></SelectTrigger>
            <SelectContent>{initialAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-1"><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-8 text-xs" placeholder="From" /></div>
        <div className="flex items-center gap-1"><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-8 text-xs" placeholder="To" /></div>
        {tab === "day-book" && (
          <Select value={journalType || "all"} onValueChange={(v) => setJournalType(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="GENERAL">General</SelectItem>
              <SelectItem value="SALES">Sales</SelectItem>
              <SelectItem value="PURCHASES">Purchases</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="BANK">Bank</SelectItem>
              <SelectItem value="RECEIPT">Receipt</SelectItem>
              <SelectItem value="PAYMENT">Payment</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={fetchReport}>Refresh</Button>
      </div>

      {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div> : !data ? <div className="py-8 text-center text-sm text-muted-foreground">No data</div> : (
        <>
          {tab === "gl" && (
            <Card className="p-0 overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground"><th className="py-2 pl-2 w-24">Date</th><th className="py-2 w-28">Number</th><th className="py-2">Description</th><th className="py-2">Account</th><th className="py-2 text-right w-24">Debit</th><th className="py-2 text-right w-24 pr-2">Credit</th></tr></thead>
                <tbody>
                  {data.data?.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No entries</td></tr> :
                    data.data?.map((l: any) => (
                      <tr key={l.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-1 pl-2 text-xs">{formatDate(l.journalEntry.date)}</td>
                        <td className="py-1 text-xs font-mono">{l.journalEntry.number}</td>
                        <td className="py-1">{l.journalEntry.description}</td>
                        <td className="py-1 text-xs"><span className="font-mono">{l.account.code}</span> {l.account.name}</td>
                        <td className="py-1 text-right">{Number(l.debit) > 0 ? formatCurrency(Number(l.debit)) : "-"}</td>
                        <td className="py-1 text-right pr-2">{Number(l.credit) > 0 ? formatCurrency(Number(l.credit)) : "-"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between p-2 border-t text-xs">
                  <span>Page {data.page} of {data.totalPages} ({data.total} entries)</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setGlPage(data.page - 1)}>Prev</Button>
                    <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => setGlPage(data.page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {tab === "trial-balance" && (
            <Card className="p-0 overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground"><th className="py-2 pl-2 w-20">Code</th><th className="py-2">Account</th><th className="py-2 w-24">Type</th><th className="py-2 text-right w-28">Debit</th><th className="py-2 text-right w-28">Credit</th><th className="py-2 text-right w-28 pr-2">Balance</th></tr></thead>
                <tbody>
                  {data.accounts?.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No accounts with balance</td></tr> :
                    data.accounts?.map((a: any) => (
                      <tr key={a.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-1 pl-2 text-xs font-mono">{a.code}</td>
                        <td className="py-1">{a.name}</td>
                        <td className="py-1"><Badge variant="outline" className="text-[10px]">{a.type.replace("_", " ")}</Badge></td>
                        <td className={`py-1 text-right ${Number(a.trialDebit) > 0 ? "font-medium" : ""}`}>{Number(a.trialDebit) > 0 ? formatCurrency(Number(a.trialDebit)) : "-"}</td>
                        <td className={`py-1 text-right ${Number(a.trialCredit) > 0 ? "font-medium" : ""}`}>{Number(a.trialCredit) > 0 ? formatCurrency(Number(a.trialCredit)) : "-"}</td>
                        <td className="py-1 text-right pr-2 font-medium">{formatCurrency(a.balance)}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-medium text-sm">
                    <td colSpan={3} className="py-2 pl-2">Total</td>
                    <td className="py-2 text-right">{formatCurrency(data.totalDebit)}</td>
                    <td className="py-2 text-right">{formatCurrency(data.totalCredit)}</td>
                    <td className="py-2 text-right pr-2"></td>
                  </tr>
                  {Math.abs(Number(data.difference || 0)) > 0.01 && (
                    <tr className="border-t bg-destructive/10 text-sm font-medium text-destructive">
                      <td colSpan={3} className="py-2 pl-2">Difference</td>
                      <td colSpan={3} className="py-2 pr-2 text-right">{formatCurrency(Number(data.difference || 0))}</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </Card>
          )}

          {tab === "balance-sheet" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 text-blue-600">Assets</h3>
                {renderAccountList(data.assets)}
                <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold"><span>Total Assets</span><span>{formatCurrency(data.totalAssets)}</span></div>
              </Card>
              <div className="space-y-4">
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3 text-orange-600">Liabilities</h3>
                  {renderAccountList(data.liabilities)}
                  <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold"><span>Total Liabilities</span><span>{formatCurrency(data.totalLiabilities)}</span></div>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3 text-green-600">Equity</h3>
                  {renderAccountList(data.equity)}
                  <div className="border-t pt-1 mt-1 flex justify-between text-xs"><span>Net Income (Current)</span><span>{formatCurrency(data.netIncome)}</span></div>
                  <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold"><span>Total Equity</span><span>{formatCurrency(data.totalEquity)}</span></div>
                </Card>
                <Card className="p-4 bg-muted/30">
                  <div className="flex justify-between text-sm font-bold"><span>Total Liabilities & Equity</span><span>{formatCurrency(data.totalLiabilitiesEquity)}</span></div>
                </Card>
              </div>
            </div>
          )}

          {tab === "profit-loss" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 text-emerald-600">Income</h3>
                {renderAccountList(data.income)}
                <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold"><span>Total Income</span><span>{formatCurrency(data.totalIncome)}</span></div>
              </Card>
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 text-red-600">Expenses</h3>
                {renderAccountList(data.expenses)}
                <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold"><span>Total Expenses</span><span>{formatCurrency(data.totalExpenses)}</span></div>
              </Card>
              <Card className="lg:col-span-2 p-4 bg-muted/30">
                <div className="flex justify-between text-lg font-bold"><span>Net Profit / (Loss)</span><span className={data.netProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(data.netProfit)}</span></div>
              </Card>
            </div>
          )}

          {tab === "day-book" && (
            <Card className="p-0 overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground"><th className="py-2 pl-2 w-24">Date</th><th className="py-2 w-28">Number</th><th className="py-2">Description</th><th className="py-2 w-20">Type</th><th className="py-2">Account</th><th className="py-2 text-right w-24">Debit</th><th className="py-2 text-right w-24 pr-2">Credit</th></tr></thead>
                <tbody>
                  {(!data || data.length === 0) ? <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No entries</td></tr> :
                    data.map((e: any) => {
                      const dr = e.lines?.reduce((s: number, l: any) => s + Number(l.debit), 0) || 0;
                      const cr = e.lines?.reduce((s: number, l: any) => s + Number(l.credit), 0) || 0;
                      return (
                        <tr key={e.id} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="py-1 pl-2 text-xs">{formatDate(e.date)}</td>
                          <td className="py-1 text-xs font-mono">{e.number}</td>
                          <td className="py-1">{e.description || "-"}</td>
                          <td className="py-1"><Badge variant="outline" className="text-[10px]">{e.journalType}</Badge></td>
                          <td className="py-1 text-xs">{e.lines?.slice(0, 2).map((l: any) => `${l.account.code}`).join(", ")}{e.lines?.length > 2 ? " ..." : ""}</td>
                          <td className="py-1 text-right">{dr > 0 ? formatCurrency(dr) : "-"}</td>
                          <td className="py-1 text-right pr-2">{cr > 0 ? formatCurrency(cr) : "-"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function renderAccountList(accounts: any[]) {
  if (!accounts || accounts.length === 0) return <p className="text-xs text-muted-foreground">None</p>;
  return (
    <div className="space-y-1">
      {accounts.map((a: any) => (
        <div key={a.id} className="flex justify-between text-xs">
          <span><span className="font-mono">{a.code}</span> {a.name}</span>
          <span className={a.balance >= 0 ? "" : "text-red-500"}>{formatCurrency(a.balance)}</span>
        </div>
      ))}
    </div>
  );
}
