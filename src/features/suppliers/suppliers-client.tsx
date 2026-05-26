"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Building2, Eye, Truck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useToast } from "@/providers/toast-provider";
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
import type { Supplier } from "@prisma/client";
import { ImportDialog } from "@/components/shared/import/import-dialog";
import { ActionsMenu } from "@/components/shared/actions-menu";
import { type DataViewMode, ViewSwitcher } from "@/components/shared/view-switcher";

interface SuppliersClientProps {
  suppliers: Supplier[];
}

export function SuppliersClient({ suppliers }: SuppliersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const { addToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", city: "", taxId: "" });
  const [loading, setLoading] = useState(false);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<DataViewMode>("list");

  useEffect(() => {
    const createSupplier = searchParams.get("createSupplier");
    if (!createSupplier) return;
    setForm((prev) => ({ ...prev, name: createSupplier }));
    setDialogOpen(true);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      addToast({ title: "Supplier created", variant: "success" });
      setDialogOpen(false);
      setForm({ name: "", phone: "", email: "", address: "", city: "", taxId: "" });
      router.refresh();
    } catch { addToast({ title: "Error", variant: "error" }); } finally { setLoading(false); }
  }

  async function openDetail(supplier: Supplier) {
    setDetailSupplier(supplier);
    setDetailOpen(true);
    try {
      const res = await fetch(`/api/purchases?supplierId=${supplier.id}&pageSize=10`);
      const data = await res.json();
      if (data.success) setPurchases(data.data.data || []);
    } catch { setPurchases([]); }
  }

  return (
    <div>
      <PageHeader title="Suppliers" description="Manage your suppliers and vendors">
        <ActionsMenu
          items={[
            { label: "Add Supplier", icon: Plus, onSelect: () => setDialogOpen(true) },
            { label: "Import Suppliers", icon: Upload, onSelect: () => setImportOpen(true) },
          ]}
        />
      </PageHeader>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">{suppliers.length} suppliers</p>
            <p className="text-xs text-muted-foreground">Use list for scanning and kanban for relationship review.</p>
          </div>
          <ViewSwitcher value={viewMode} onChange={setViewMode} />
        </div>
        {suppliers.length === 0 ? (
          <EmptyState icon={Building2} title="No suppliers yet" description="Add your first supplier" />
        ) : viewMode === "kanban" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {suppliers.map((s) => (
              <div key={s.id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-foreground">{s.name}</h3>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{s.email || s.phone || "No contact added"}</p>
                  </div>
                  <ActionsMenu
                    compact
                    items={[{ label: "View supplier", icon: Eye, onSelect: () => openDetail(s) }]}
                  />
                </div>
                <div className="mt-4 rounded-lg bg-secondary/70 p-3 text-sm">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Total Purchases</p>
                  <p className="mt-1 text-lg font-bold">{formatCurrency(Number(s.totalSales))}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.city && <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">{s.city}</span>}
                  {s.taxId && <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">Tax ID</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="block sm:hidden">
              <div className="divide-y">
                {suppliers.map((s) => (
                  <div key={s.id} className="space-y-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{s.name}</p>
                      <ActionsMenu
                        compact
                        items={[{ label: "View supplier", icon: Eye, onSelect: () => openDetail(s) }]}
                      />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {s.phone && <span>{s.phone}</span>}
                      {s.email && <span>{s.email}</span>}
                      {s.city && <span>{s.city}</span>}
                    </div>
                    <p className="text-xs">
                      <span className="text-muted-foreground">Total Purchases: </span>
                      <span className="font-medium">{formatCurrency(Number(s.totalSales))}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Total Purchases</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.phone || "-"}</TableCell>
                      <TableCell>{s.email || "-"}</TableCell>
                      <TableCell>{s.city || "-"}</TableCell>
                      <TableCell>{formatCurrency(Number(s.totalSales))}</TableCell>
                      <TableCell>
                        <ActionsMenu
                          compact
                          items={[{ label: "View supplier", icon: Eye, onSelect: () => openDetail(s) }]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        type="suppliers"
        title="Import Suppliers"
        description="Upload an Excel file to bulk import suppliers"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Supplier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input label="VAT / Tax Number" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {detailSupplier?.name}
            </DialogTitle>
          </DialogHeader>
          {detailSupplier && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{detailSupplier.phone || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{detailSupplier.email || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-medium">{detailSupplier.address || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">City</p>
                  <p className="font-medium">{detailSupplier.city || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Sales</p>
                  <p className="font-medium">{formatCurrency(Number(detailSupplier.totalSales))}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Recent Purchases</p>
                {purchases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No purchases yet</p>
                ) : (
                  <div className="space-y-2">
                    {purchases.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                        <div>
                          <p className="font-medium">{p.referenceNumber}</p>
                          <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className="font-medium">{formatCurrency(Number(p.total))}</span>
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
