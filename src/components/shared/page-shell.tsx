import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

/** Consistent vertical rhythm for dashboard pages. */
export function PageShell({ children, className }: PageShellProps) {
  return <div className={cn("page-stack", className)}>{children}</div>;
}
