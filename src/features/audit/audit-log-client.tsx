"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/providers/toast-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Loader2,
  Search,
  Filter,
  Shield,
  User,
  FileText,
  ShoppingCart,
  Package,
  Truck,
  Settings,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Download,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ElementType } from "react";

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
  READ: Eye,
  LOGIN: LogIn,
  LOGOUT: LogOut,
  EXPORT: Download,
  IMPORT: Upload,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  LOGIN: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  LOGOUT: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const ENTITY_ICONS: Record<string, LucideIcon> = {
  Sale: ShoppingCart,
  Purchase: Truck,
  Product: Package,
  Customer: User,
  Supplier: User,
  User: User,
  Settings: Settings,
  Profile: User,
};

export function AuditLogClient() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterEntity, setFilterEntity] = useState<string>("");
  const [filterAction, setFilterAction] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (filterEntity) params.set("entity", filterEntity);
      if (filterAction) params.set("action", filterAction);

      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.data);
        setTotalPages(json.data.totalPages);
        setTotal(json.data.total);
      }
    } catch {
      addToast({ title: "Error fetching audit logs", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [page, filterEntity, filterAction, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function formatTimestamp(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function ActionIcon({ action }: { action: string }) {
    const Icon = (ACTION_ICONS[action] || Shield) as ElementType;
    return <Icon className="h-3.5 w-3.5" />;
  }

  function EntityIcon({ entity }: { entity: string }) {
    const Icon = (ENTITY_ICONS[entity] || FileText) as ElementType;
    return <Icon className="h-3.5 w-3.5 text-muted-foreground" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Activity History</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              {total} total events
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by user, entity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="Sale">Sales</SelectItem>
                <SelectItem value="Purchase">Purchases</SelectItem>
                <SelectItem value="Product">Products</SelectItem>
                <SelectItem value="Customer">Customers</SelectItem>
                <SelectItem value="Supplier">Suppliers</SelectItem>
                <SelectItem value="User">Users</SelectItem>
                <SelectItem value="Settings">Settings</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
                <SelectItem value="LOGOUT">Logout</SelectItem>
                <SelectItem value="EXPORT">Export</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => { setFilterEntity(""); setFilterAction(""); setPage(1); }}>
              Clear
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No activity yet"
              description="Actions performed in your organization will appear here"
            />
          ) : (
            <div className="space-y-2">
              {logs
                .filter((log) => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    log.user.name?.toLowerCase().includes(q) ||
                    log.user.email.toLowerCase().includes(q) ||
                    log.entity.toLowerCase().includes(q) ||
                    log.entityId?.toLowerCase().includes(q)
                  );
                })
                .map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <EntityIcon entity={log.entity} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {log.user.name || log.user.email}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${ACTION_COLORS[log.action] || ""}`}
                        >
                          <ActionIcon action={log.action} />
                          <span className="ml-1">{log.action.toLowerCase()}</span>
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {log.entity}
                        </span>
                        {log.entityId && (
                          <code className="text-[10px] text-muted-foreground">
                            #{log.entityId.slice(0, 8)}
                          </code>
                        )}
                      </div>
                      {log.metadata && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                          {JSON.stringify(log.metadata).slice(0, 120)}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(log.createdAt)}
                      </p>
                      {log.ipAddress && (
                        <p className="text-[10px] text-muted-foreground">
                          {log.ipAddress}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
