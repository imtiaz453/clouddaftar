"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardCheck,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReconciliationClientProps {
  initialData: any;
  customers: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}

const statusVariants: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  OPEN: "warning",
  IN_PROGRESS: "default",
  RECONCILED: "success",
  MISMATCHED: "destructive",
};

export function ReconciliationClient({
  initialData,
  customers,
  suppliers,
}: ReconciliationClientProps) {
  const { addToast } = useToast();
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState("OPEN");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [reconType, setReconType] = useState("CUSTOMER");
  const [reconEntityId, setReconEntityId] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedRecon, setSelectedRecon] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const filteredData =
    data.data?.filter((r: any) => activeTab === "ALL" || r.status === activeTab) || [];

  const handleCreate = async () => {
    if (!reconEntityId) {
      addToast({ title: "Select a customer/supplier", variant: "error" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/accounting/reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: reconType,
          referenceId: reconEntityId,
          referenceType: reconType,
        }),
      });
      if (!res.ok) throw new Error();
      addToast({ title: "Reconciliation created", variant: "success" });
      setNewDialogOpen(false);
      const refreshed = await fetch("/api/accounting/reconciliations").then((r) => r.json());
      if (refreshed.success) setData(refreshed.data);
    } catch {
      addToast({ title: "Error creating reconciliation", variant: "error" });
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (id: string) => {
    const res = await fetch(`/api/accounting/reconciliations/${id}`).then((r) => r.json());
    if (res.success) {
      setSelectedRecon(res.data);
      setDetailOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Match payments with invoices and detect discrepancies"
      >
        <Button onClick={() => setNewDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Reconciliation
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="OPEN">Open</TabsTrigger>
          <TabsTrigger value="IN_PROGRESS">In Progress</TabsTrigger>
          <TabsTrigger value="RECONCILED">Reconciled</TabsTrigger>
          <TabsTrigger value="MISMATCHED">Mismatched</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-0">
        {filteredData.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No reconciliations found"
            description="Create a new reconciliation to start matching payments"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Matched</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant="outline">{r.type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{r.entityName || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.totalAllocated)}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(r.totalMatched)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${r.difference > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    {formatCurrency(Math.abs(r.difference))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[r.status] || "secondary"}>
                      {r.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openDetail(r.id)}
                      title="View reconciliation"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Reconciliation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <select
                value={reconType}
                onChange={(e) => setReconType(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="CUSTOMER">Customer (Receivables)</option>
                <option value="SUPPLIER">Supplier (Payables)</option>
              </select>
            </div>
            <div>
              <Label>{reconType === "CUSTOMER" ? "Customer" : "Supplier"}</Label>
              <select
                value={reconEntityId}
                onChange={(e) => setReconEntityId(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Select...</option>
                {(reconType === "CUSTOMER" ? customers : suppliers).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <LoadingSpinner size={4} className="mr-2" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reconciliation Detail</DialogTitle>
          </DialogHeader>
          {selectedRecon && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">Total Allocated</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">
                      {formatCurrency(selectedRecon.totalAllocated)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">Total Matched</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(selectedRecon.totalMatched)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">Difference</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p
                      className={`text-lg font-bold ${selectedRecon.difference > 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {formatCurrency(Math.abs(selectedRecon.difference))}
                    </p>
                  </CardContent>
                </Card>
              </div>
              {selectedRecon.allocations?.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment</TableHead>
                      <TableHead>Invoice/PO</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-right">Matched</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedRecon.allocations.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">
                          {a.payment?.reference || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {a.sale?.invoiceNumber || a.purchase?.referenceNumber || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(a.allocatedAmount)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(a.matchedAmount)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${a.difference > 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          {formatCurrency(Math.abs(a.difference))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              a.status === "MATCHED"
                                ? "success"
                                : a.status === "MISMATCHED"
                                  ? "destructive"
                                  : "warning"
                            }
                          >
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
