import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const isDateInput = type === "date" || type === "datetime-local" || type === "month";
    const dateValue = props.value ?? props.defaultValue;
    const isDateEmpty =
      isDateInput && (dateValue === undefined || dateValue === null || dateValue === "");
    const datePlaceholder = props.placeholder || label || "Select date";
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
        <div className={cn(isDateInput && "relative")}>
          <input
            id={inputId}
            type={type}
            data-empty={isDateEmpty ? "true" : undefined}
            className={cn(
              "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
              isDateInput && "date-input",
              isDateEmpty && "date-input-empty",
              error && "border-destructive focus-visible:ring-destructive/30",
              className,
            )}
            ref={ref}
            {...props}
          />
          {isDateEmpty && (
            <span className="date-input-placeholder pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {datePlaceholder}
            </span>
          )}
        </div>
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
