"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/providers/toast-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

interface NotificationsClientProps {
  initialData: {
    data: Notification[];
    total: number;
    unreadCount: number;
    page: number;
    pageSize: number;
  };
}

const typeIcons: Record<string, typeof Info> = {
  INFO: Info,
  WARNING: AlertTriangle,
  SUCCESS: CheckCircle,
  ERROR: XCircle,
};

const typeVariants: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  INFO: "default",
  WARNING: "warning",
  SUCCESS: "success",
  ERROR: "destructive",
};

export function NotificationsClient({ initialData }: NotificationsClientProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const tenant = segments.length >= 2 && segments[1] === "notifications" ? segments[0] : null;
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  const loadPage = useCallback(
    async (newPage: number) => {
      setPage(newPage);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (unreadOnly) params.set("unreadOnly", "true");
        params.set("page", newPage.toString());
        params.set("pageSize", "20");
        const res = await fetch(`/api/notifications?${params}`);
        if (res.ok) {
          const d = await res.json();
          setData(d.success ? d.data : d);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    },
    [unreadOnly],
  );

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        addToast({ title: "All marked as read", variant: "success" });
        window.dispatchEvent(new Event("notifications:refresh"));
        loadPage(page);
      }
    } catch {
      addToast({ title: "Failed to mark as read", variant: "error" });
    }
  };

  const markRead = async (notification: Notification) => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      });
      const wasUnread = !notification.isRead;
      setData((prev) => ({
        ...prev,
        data: prev.data.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
        unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
      }));
      window.dispatchEvent(new Event("notifications:refresh"));
      if (notification.link) {
        router.push(tenant ? `/${tenant}${notification.link}` : notification.link);
      }
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1 text-xs">
            <Bell className="h-3 w-3" /> {data.unreadCount} unread
          </Badge>
          <Button
            variant={unreadOnly ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setUnreadOnly(!unreadOnly);
              setPage(1);
            }}
          >
            {unreadOnly ? "All" : "Unread only"}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={markAllRead}
          disabled={data.unreadCount === 0}
        >
          <CheckCheck className="mr-1 h-3.5 w-3.5" />
          Mark All Read
        </Button>
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Notification</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      <BellOff className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      {unreadOnly ? "No unread notifications" : "No notifications yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((n) => {
                    const Icon = typeIcons[n.type] || Info;
                    return (
                      <TableRow
                        key={n.id}
                        className={`${n.isRead ? "" : "bg-muted/30"} cursor-pointer`}
                        onClick={() => markRead(n)}
                      >
                        <TableCell>
                          <Icon
                            className={`h-4 w-4 ${n.type === "WARNING" ? "text-amber-500" : n.type === "SUCCESS" ? "text-green-500" : n.type === "ERROR" ? "text-red-500" : "text-blue-500"}`}
                          />
                        </TableCell>
                        <TableCell>
                          <p
                            className={`text-sm ${n.isRead ? "text-muted-foreground" : "font-medium"}`}
                          >
                            {n.title}
                          </p>
                          {n.message && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(n.createdAt)}
                        </TableCell>
                        <TableCell>
                          {n.isRead ? (
                            <Badge variant="outline" className="text-xs">
                              Read
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs">
                              New
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">{data.total} total</p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => loadPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.data.length < 20}
                  onClick={() => loadPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
