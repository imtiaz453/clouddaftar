"use client";

import type { TooltipProps } from "recharts";
import { formatCurrency } from "@/lib/utils";

function formatMoney(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return formatCurrency(Number.isFinite(n) ? n : 0);
}

/** Recharts tooltip that formats numeric payload values as currency. */
export function ChartCurrencyTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-lg">
      {label != null && label !== "" && (
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={entry.dataKey?.toString() ?? entry.name} className="flex items-center gap-2">
            {entry.color != null && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color as string }}
              />
            )}
            <span className="text-muted-foreground">{entry.name ?? "Amount"}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">
              {formatMoney(entry.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
