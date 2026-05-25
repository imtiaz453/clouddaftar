import { AuditLogClient } from "./audit-log-client";

export function AuditLogPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Track all activities and changes in your organization
        </p>
      </div>
      <AuditLogClient />
    </div>
  );
}
