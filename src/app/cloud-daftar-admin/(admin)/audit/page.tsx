"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface AuditLog {
  id: string; action: string; entity: string | null; entityId: string | null;
  metadata: any; createdAt: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit?page=${p}`);
      const d = await res.json();
      if (d.success) {
        setLogs(d.data.data);
        setTotal(d.data.total);
        setTotalPages(d.data.totalPages);
        setPage(d.data.page);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  const actionColor: Record<string, "default" | "success" | "destructive" | "warning"> = {
    PAYMENT_CONFIRMED: "success",
    PAYMENT_REJECTED: "destructive",
    TENANT_SUSPENDED: "warning",
    TENANT_REACTIVATED: "success",
    SUBSCRIPTION_EXTENDED: "default",
    PLAN_CHANGED: "default",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">System-wide activity and changes</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size={8} /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No audit logs yet</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Date & Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant={actionColor[log.action] || "secondary"} className="font-mono text-xs">
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.entity}
                        <span className="text-xs text-muted-foreground ml-1">#{log.entityId?.slice(0, 8)}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({total} total)</p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)}>
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
