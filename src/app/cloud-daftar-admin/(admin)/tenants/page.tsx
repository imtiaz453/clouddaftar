"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronLeft, ChevronRight, Search, Building, Users, Package, ShoppingCart, FileText } from "lucide-react";

interface Tenant {
  id: string; name: string; slug: string; email: string | null; phone: string | null;
  city: string | null; isActive: boolean; createdAt: string;
  subscription: { id: string; status: string; billingCycle: string; endDate: string; plan: { name: string } } | null;
  members: { user: { name: string; email: string } }[];
  _count: { members: number; products: number; sales: number; invoices: number };
}

export default function AdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchTenants = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/tenants?${params}`);
      const d = await res.json();
      if (d.success) {
        setTenants(d.data.data);
        setTotal(d.data.total);
        setTotalPages(d.data.totalPages);
        setPage(d.data.page);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTenants(1, search); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchTenants(1, search);
  }

  const statusColor: Record<string, "success" | "warning" | "destructive" | "default"> = {
    ACTIVE: "success", TRIAL: "default", EXPIRED: "destructive", SUSPENDED: "warning",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
        <p className="text-muted-foreground">Manage all companies on the platform</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug..."
            className="flex h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No tenants found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/cloud-daftar-admin/tenants/${t.id}`)}>
                      <TableCell>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.slug}</p>
                      </TableCell>
                      <TableCell>{t.subscription?.plan?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor[t.subscription?.status as keyof typeof statusColor] || "secondary"}>
                          {t.subscription?.status || "NONE"}
                        </Badge>
                      </TableCell>
                      <TableCell><Users className="inline h-3 w-3 mr-1" />{t._count.members}</TableCell>
                      <TableCell>{t._count.products}</TableCell>
                      <TableCell>{t._count.sales}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/cloud-daftar-admin/tenants/${t.id}`); }}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({total} total)</p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchTenants(page - 1, search)} title="Previous page">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => fetchTenants(page + 1, search)} title="Next page">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
