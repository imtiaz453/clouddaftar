"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Users, Eye, Upload, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { useToast } from "@/providers/toast-provider";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { Customer } from "@prisma/client";
import { ImportDialog } from "@/components/shared/import/import-dialog";
import { ActionsMenu } from "@/components/shared/actions-menu";
import { type DataViewMode, ViewSwitcher } from "@/components/shared/view-switcher";

interface CustomersClientProps {
  customers: Customer[];
}

export function CustomersClient({ customers }: CustomersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const { addToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", city: "", taxId: "", creditLimit: 0 });
  const [loading, setLoading] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<DataViewMode>("list");

  useEffect(() => {
    const createCustomer = searchParams.get("createCustomer");
    if (!createCustomer) return;
    setForm((prev) => ({ ...prev, name: createCustomer }));
    setDialogOpen(true);
  }, [searchParams]);

  function openNewDialog() {
    setEditingCustomer(null);
    setForm({ name: "", phone: "", email: "", address: "", city: "", taxId: "", creditLimit: 0 });
    setDialogOpen(true);
  }

  function openEditDialog(customer: Customer) {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      city: customer.city || "",
      taxId: customer.taxId || "",
      creditLimit: Number(customer.creditLimit),
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const isEdit = !!editingCustomer;
      const res = await fetch("/api/customers", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: editingCustomer.id, ...form } : form),
      });
      if (!res.ok) throw new Error("Failed to save customer");
      addToast({ title: isEdit ? "Customer updated" : "Customer created", variant: "success" });
      setDialogOpen(false);
      setEditingCustomer(null);
      setForm({ name: "", phone: "", email: "", address: "", city: "", taxId: "", creditLimit: 0 });
      router.refresh();
    } catch { addToast({ title: "Error", variant: "error" }); } finally { setLoading(false); }
  }

  async function openDetail(customer: Customer) {
    setDetailCustomer(customer);
    setDetailOpen(true);
    try {
      const res = await fetch(`/api/sales?customerId=${customer.id}&pageSize=10`);
      const data = await res.json();
      if (data.success) setSales(data.data.data || []);
    } catch { setSales([]); }
  }

  return (
    <div>
      <PageHeader title="Customers" description="Manage your customer base">
        <Button size="sm" onClick={() => openNewDialog()}>
          <Plus className="mr-2 h-4 w-4" /> New Customer
        </Button>
        <ActionsMenu
          items={[
            { label: "Import Customers", icon: Upload, onSelect: () => setImportOpen(true) },
          ]}
        />
      </PageHeader>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">{customers.length} customers</p>
            <p className="text-xs text-muted-foreground">Switch between operational list and visual kanban.</p>
          </div>
          <ViewSwitcher value={viewMode} onChange={setViewMode} />
        </div>
        {customers.length === 0 ? (
          <EmptyState icon={Users} title="No customers yet" description="Add your first customer" />
        ) : viewMode === "kanban" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {customers.map((c) => {
              const totalPurchases = Number(c.totalPurchases);
              const creditLimit = Number(c.creditLimit);
              const overLimit = creditLimit > 0 && totalPurchases > creditLimit;
              return (
                <div key={c.id} className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-foreground">{c.name}</h3>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{c.email || c.phone || "No contact added"}</p>
                    </div>
                    <ActionsMenu
                      compact
                      items={[
                        { label: "View customer", icon: Eye, onSelect: () => openDetail(c) },
                        { label: "Edit customer", icon: Pencil, onSelect: () => openEditDialog(c) },
                      ]}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-secondary/70 p-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Purchases</p>
                      <p className="mt-1 font-bold">{formatCurrency(totalPurchases)}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/70 p-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Credit</p>
                      <p className={overLimit ? "mt-1 font-bold text-destructive" : "mt-1 font-bold"}>
                        {creditLimit > 0 ? formatCurrency(creditLimit) : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {c.city && <Badge variant="secondary">{c.city}</Badge>}
                    {overLimit && <Badge variant="destructive">Limit exceeded</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Total Purchases</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => {
                const totalPurchases = Number(c.totalPurchases);
                const creditLimit = Number(c.creditLimit);
                const overLimit = creditLimit > 0 && totalPurchases > creditLimit;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone || "-"}</TableCell>
                    <TableCell>{c.email || "-"}</TableCell>
                    <TableCell>{c.city || "-"}</TableCell>
                    <TableCell>{formatCurrency(totalPurchases)}</TableCell>
                    <TableCell>
                      {creditLimit > 0 ? (
                        <span className={overLimit ? "text-red-600 font-medium" : ""}>
                          {formatCurrency(creditLimit)}
                          {overLimit && <Badge variant="destructive" className="ml-1 text-[10px]">Exceeded</Badge>}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <ActionsMenu
                        compact
                        items={[
                          { label: "View customer", icon: Eye, onSelect: () => openDetail(c) },
                          { label: "Edit customer", icon: Pencil, onSelect: () => openEditDialog(c) },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        type="customers"
        title="Import Customers"
        description="Upload an Excel file to bulk import customers"
      />

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setEditingCustomer(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input label="VAT / Tax Number" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <Input label="Credit Limit" type="number" min="0" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : editingCustomer ? "Update" : "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {detailCustomer?.name}
            </DialogTitle>
          </DialogHeader>
          {detailCustomer && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openEditDialog(detailCustomer); }}>
                  <Pencil className="mr-2 h-4 w-4" />Edit
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{detailCustomer.phone || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{detailCustomer.email || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-medium">{detailCustomer.address || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">City</p>
                  <p className="font-medium">{detailCustomer.city || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Purchases</p>
                  <p className="font-medium">{formatCurrency(Number(detailCustomer.totalPurchases))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Credit Limit</p>
                  <p className="font-medium">{Number(detailCustomer.creditLimit) > 0 ? formatCurrency(Number(detailCustomer.creditLimit)) : "N/A"}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Recent Sales</p>
                {sales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales yet</p>
                ) : (
                  <div className="space-y-2">
                    {sales.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                        <div>
                          <p className="font-medium">{s.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className="font-medium">{formatCurrency(Number(s.total))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
