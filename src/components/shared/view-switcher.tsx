"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataViewMode = "list" | "kanban";

interface ViewSwitcherProps {
  value: DataViewMode;
  onChange: (value: DataViewMode) => void;
  className?: string;
}

export function ViewSwitcher({ value, onChange, className }: ViewSwitcherProps) {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center gap-0.5 rounded-lg border border-border/80 bg-muted/40 p-0.5",
        className,
      )}
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
          value === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={value === "list"}
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">List</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("kanban")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
          value === "kanban"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={value === "kanban"}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Board</span>
      </button>
    </div>
  );
}
