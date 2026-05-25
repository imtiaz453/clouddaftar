"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, FolderTree, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/providers/toast-provider";
import { Badge } from "@/components/ui/badge";

const ACCOUNT_TYPES = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
  { value: "CONTRA_ASSET", label: "Contra Asset" },
  { value: "CONTRA_LIABILITY", label: "Contra Liability" },
  { value: "CONTRA_INCOME", label: "Contra Income" },
  { value: "CONTRA_EXPENSE", label: "Contra Expense" },
];

const TYPE_COLORS: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  LIABILITY: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  EQUITY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  INCOME: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  EXPENSE: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

interface Account {
  id: string; code: string; name: string; type: string; parentId: string | null; description: string | null;
  children?: Account[];
}

function buildTree(accounts: Account[]): Account[] {
  const map = new Map<string, Account>();
  const roots: Account[] = [];
  accounts.forEach((a) => { a.children = []; map.set(a.id, a); });
  accounts.forEach((a) => {
    if (a.parentId && map.has(a.parentId)) map.get(a.parentId)!.children!.push(a);
    else roots.push(a);
  });
  return roots;
}

function AccountRow({ account, depth = 0 }: { account: Account; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = account.children && account.children.length > 0;
  return (
    <>
      <tr className="border-b border-border/50 hover:bg-muted/30">
        <td className="py-1.5 pl-2 text-xs text-muted-foreground" style={{ paddingLeft: `${12 + depth * 20}px` }}>
          {hasChildren ? (
            <button onClick={() => setExpanded(!expanded)} className="inline-flex items-center gap-1">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span className="font-mono">{account.code}</span>
            </button>
          ) : (
            <span className="font-mono ml-4">{account.code}</span>
          )}
        </td>
        <td className="py-1.5 text-sm font-medium">{account.name}</td>
        <td className="py-1.5"><Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[account.type] || ""}`}>{account.type.replace("_", " ")}</Badge></td>
      </tr>
      {expanded && hasChildren && account.children!.map((child) => <AccountRow key={child.id} account={child} depth={depth + 1} />)}
    </>
  );
}

export function ChartOfAccountsClient({ initialAccounts }: { initialAccounts: Account[] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [tree, setTree] = useState<Account[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "ASSET" as string, parentId: "" as string, description: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { setTree(buildTree(accounts)); }, [accounts]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/accounting/coa");
    if (res.ok) { const d = await res.json(); if (d.success) setAccounts(d.data); }
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ code: "", name: "", type: "ASSET", parentId: "", description: "" });
    setDialogOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setForm({ code: account.code, name: account.name, type: account.type, parentId: account.parentId || "", description: account.description || "" });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editing ? `/api/accounting/coa?id=${editing.id}` : "/api/accounting/coa";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? form : { ...form, parentId: form.parentId || undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      addToast({ title: editing ? "Account updated" : "Account created", variant: "success" });
      setDialogOpen(false);
      refresh();
    } catch { addToast({ title: "Error", variant: "error" }); } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deactivate this account?")) return;
    try {
      const res = await fetch(`/api/accounting/coa?id=${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      addToast({ title: "Account deactivated", variant: "success" });
      refresh();
    } catch (e: any) { addToast({ title: "Error", description: e.message, variant: "error" }); }
  }

  return (
    <div>
      <PageHeader title="Chart of Accounts" description="Manage your chart of accounts">
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New Account</Button>
      </PageHeader>
      <Card className="p-0 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="py-2 pl-2 w-24">Code</th>
              <th className="py-2">Account Name</th>
              <th className="py-2 w-32">Type</th>
              <th className="py-2 w-20 text-right pr-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tree.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No accounts yet. Click "New Account" to create one.</td></tr>
            ) : tree.map((a) => <AccountRow key={a.id} account={a} />)}
          </tbody>
        </table>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Code *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="1.1.1" />
              <div>
                <label className="mb-1.5 block text-sm font-medium">Type *</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Cash & Bank" />
            <div>
              <label className="mb-1.5 block text-sm font-medium">Parent Account</label>
              <Select value={form.parentId || "none"} onValueChange={(v) => setForm({ ...form, parentId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None (top level)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top level)</SelectItem>
                  {accounts.filter((a) => a.id !== editing?.id).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : (editing ? "Update" : "Create")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
