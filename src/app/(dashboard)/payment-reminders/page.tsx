import { requireCompanyAuth } from "@/lib/auth-helper";
import { getPaymentReminders, getPaymentCommitments } from "@/actions/accounting";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function PaymentRemindersPage() {
  await requireCompanyAuth();
  const [reminders, commitments] = await Promise.all([
    getPaymentReminders({ page: 1, pageSize: 50 }).catch(() => ({
      data: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
    })),
    getPaymentCommitments({ page: 1, pageSize: 50 }).catch(() => ({
      data: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
    })),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Reminders & Commitments"
        description="Track follow-ups and payment promises"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            {reminders.data.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No reminders yet</p>
            ) : (
              <div className="divide-y">
                {reminders.data.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{r.message || "Reminder"}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.type} - {formatDate(r.createdAt)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        r.status === "SENT"
                          ? "success"
                          : r.status === "PENDING"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Commitments</CardTitle>
          </CardHeader>
          <CardContent>
            {commitments.data.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No payment commitments yet
              </p>
            ) : (
              <div className="divide-y">
                {commitments.data.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(c.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Expected: {c.expectedDate ? formatDate(c.expectedDate) : "N/A"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        c.status === "FULFILLED"
                          ? "success"
                          : c.status === "PARTIALLY_FULFILLED"
                            ? "warning"
                            : c.status === "CANCELLED"
                              ? "destructive"
                              : "secondary"
                      }
                    >
                      {c.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
