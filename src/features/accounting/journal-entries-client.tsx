"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";

const JOURNAL_TYPES = [
  { value: "GENERAL", label: "General" },
  { value: "SALES", label: "Sales" },
  { value: "PURCHASES", label: "Purchases" },
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "PAYMENT", label: "Payment" },
];

interface Account { id: string; code: string; name: string; }

export function JournalEntriesClient({ initialAccounts }: { initialAccounts: Account[] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [journalType, setJournalType] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [form, setForm] = useState<{ date: string; description: string; journalType: string; reference: string; lines: { accountId: string; debit: string; credit: string; description: string }[] }>({
    date: new Date().toISOString().split("T")[0],
    description: "",
    journalType: "GENERAL",
    reference: "",
    lines: [{ accountId: "", debit: "", credit: "", description: "" }],
  });
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (journalType) params.set("journalType", journalType);
      const res = await fetch(`/api/accounting/journal-entries?${params}`);
      if (res.ok) { const d = await res.json(); if (d.success) { setEntries(d.data.data); setTotal(d.data.total); } }
    } finally { setLoading(false); }
  }, [page, journalType]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  function addLine() { setForm({ ...form, lines: [...form.lines, { accountId: "", debit: "", credit: "", description: "" }] }); }
  function removeLine(i: number) { setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) }); }
  function updateLine(i: number, field: string, value: string) {
    const lines = [...form.lines];
    (lines[i] as any)[field] = value;
    setForm({ ...form, lines });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const lines = form.lines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description }));
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) { addToast({ title: "Unbalanced entry", description: `Debits: ${totalDebit}, Credits: ${totalCredit}`, variant: "error" }); return; }
      const res = await fetch("/api/accounting/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, date: new Date(form.date), lines }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      addToast({ title: "Journal entry posted", variant: "success" });
      setDialogOpen(false);
      setForm({ date: new Date().toISOString().split("T")[0], description: "", journalType: "GENERAL", reference: "", lines: [{ accountId: "", debit: "", credit: "", description: "" }] });
      fetchEntries();
    } catch (e: any) { addToast({ title: "Error", description: e.message, variant: "error" }); } finally { setSaving(false); }
  }

  async function openDetail(entry: any) {
    setDetailEntry(null);
    try {
      const res = await fetch(`/api/accounting/journal-entries?id=${entry.id}`);
      if (res.ok) { const d = await res.json(); if (d.success) setDetailEntry(d.data); }
    } catch { }
    setDetailOpen(true);
  }

  const totals = entries.reduce((acc, e) => {
    const dr = e.lines?.reduce((s: number, l: any) => s + Number(l.debit), 0) || 0;
    const cr = e.lines?.reduce((s: number, l: any) => s + Number(l.credit), 0) || 0;
    return { debit: acc.debit + dr, credit: acc.credit + cr };
  }, { debit: 0, credit: 0 });

  return (
    <div>
      <PageHeader title="Journal Entries" description="View and create journal entries">
        <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />New Entry</Button>
      </PageHeader>
      <div className="mb-4 flex items-center gap-2">
        <Select value={journalType || "all"} onValueChange={(v) => { setJournalType(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {JOURNAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{total} entries</span>
      </div>
      <Card className="p-0 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="py-2 pl-2 w-28">Number</th>
              <th className="py-2 w-24">Date</th>
              <th className="py-2">Description</th>
              <th className="py-2 w-20">Type</th>
              <th className="py-2 w-24 text-right">Debit</th>
              <th className="py-2 w-24 text-right pr-2">Credit</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Loading...</td></tr> :
              entries.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No journal entries found</td></tr> :
              entries.map((e: any) => {
                const dr = e.lines?.reduce((s: number, l: any) => s + Number(l.debit), 0) || 0;
                const cr = e.lines?.reduce((s: number, l: any) => s + Number(l.credit), 0) || 0;
                return (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => openDetail(e)}>
                    <td className="py-1.5 pl-2 text-xs font-mono">{e.number}</td>
                    <td className="py-1.5 text-xs">{formatDate(e.date)}</td>
                    <td className="py-1.5 text-sm">{e.description || "-"}</td>
                    <td className="py-1.5"><Badge variant="outline" className="text-[10px]">{e.journalType}</Badge></td>
                    <td className="py-1.5 text-right text-sm">{dr > 0 ? formatCurrency(dr) : "-"}</td>
                    <td className="py-1.5 text-right text-sm pr-2">{cr > 0 ? formatCurrency(cr) : "-"}</td>
                  </tr>
                );
              })}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium text-sm">
                <td colSpan={4} className="py-2 pl-2">Total</td>
                <td className="py-2 text-right">{formatCurrency(totals.debit)}</td>
                <td className="py-2 text-right pr-2">{formatCurrency(totals.credit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Journal Entry {detailEntry?.number}</DialogTitle></DialogHeader>
          {detailEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Date:</span> {formatDate(detailEntry.date)}</div>
                <div><span className="text-muted-foreground">Type:</span> {detailEntry.journalType}</div>
                <div><span className="text-muted-foreground">Ref:</span> {detailEntry.reference || "-"}</div>
              </div>
              <p className="text-sm">{detailEntry.description}</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1">Account</th><th className="py-1 text-right">Debit</th><th className="py-1 text-right pr-2">Credit</th></tr></thead>
                <tbody>
                  {detailEntry.lines?.map((l: any) => (
                    <tr key={l.id} className="border-b border-border/30">
                      <td className="py-1"><span className="font-mono text-xs">{l.account.code}</span> {l.account.name}</td>
                      <td className="py-1 text-right">{Number(l.debit) > 0 ? formatCurrency(Number(l.debit)) : "-"}</td>
                      <td className="py-1 text-right pr-2">{Number(l.credit) > 0 ? formatCurrency(Number(l.credit)) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Input label="Date *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              <div>
                <label className="mb-1.5 block text-sm font-medium">Type *</label>
                <Select value={form.journalType} onValueChange={(v) => setForm({ ...form, journalType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOURNAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input label="Reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <Input label="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Journal Lines</span>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>+ Add Line</Button>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1 w-1/2">Account</th><th className="py-1 w-20 text-right">Debit</th><th className="py-1 w-20 text-right">Credit</th><th className="py-1 w-8"></th></tr></thead>
                <tbody>
                  {form.lines.map((line, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-1 pr-2">
                          <Select value={line.accountId || "none"} onValueChange={(v) => updateLine(i, "accountId", v === "none" ? "" : v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
                          <SelectContent>
                            {initialAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1 pr-1"><input type="number" step="0.01" className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-right" placeholder="0" value={line.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} /></td>
                      <td className="py-1 pr-1"><input type="number" step="0.01" className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-right" placeholder="0" value={line.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} /></td>
                      <td className="py-1">{form.lines.length > 1 && <button type="button" onClick={() => removeLine(i)} className="text-red-500 text-xs">X</button>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-medium text-xs">
                    <td className="py-1">Total</td>
                    <td className="py-1 text-right">{form.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0).toFixed(2)}</td>
                    <td className="py-1 text-right">{form.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0).toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Posting..." : "Post Entry"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
