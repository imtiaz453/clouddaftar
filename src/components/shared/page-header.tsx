interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, children, eyebrow = "Workspace" }: PageHeaderProps) {
  return (
    <div className="cd-hero flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="relative z-10 min-w-0 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/90">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-[2rem]">{title}</h1>
        {description && (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{description}</p>
        )}
      </div>
      {children && (
        <div className="cd-actions-row relative z-10 shrink-0">{children}</div>
      )}
    </div>
  );
}
