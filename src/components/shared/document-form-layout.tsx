import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DocumentMetricProps {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneClass: Record<NonNullable<DocumentMetricProps["tone"]>, string> = {
  default:
    "border-slate-200 bg-white text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-white",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
  danger:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100",
};

export function DocumentMetric({ label, value, tone = "default" }: DocumentMetricProps) {
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-right", toneClass[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <div className="mt-1 text-base font-semibold leading-none sm:text-lg">{value}</div>
    </div>
  );
}

interface DocumentFormHeaderProps {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}

export function DocumentFormHeader({ title, subtitle, children }: DocumentFormHeaderProps) {
  return (
    <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-1 pb-4 dark:border-white/10 dark:from-white/5 dark:to-transparent">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children ? (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

interface DocumentFormSectionProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DocumentFormSection({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: DocumentFormSectionProps) {
  return (
    <section className={cn("rounded-lg border border-border/80 bg-card shadow-sm", className)}>
      <div className="flex flex-col gap-2 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </section>
  );
}

export function DocumentSummaryPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-primary/15 bg-gradient-to-br from-background to-muted/50 p-4 shadow-sm",
        className,
      )}
    >
      <div className="ml-auto w-full max-w-md space-y-2">{children}</div>
    </section>
  );
}

export const documentTextareaClassName =
  "mt-1 min-h-28 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";
