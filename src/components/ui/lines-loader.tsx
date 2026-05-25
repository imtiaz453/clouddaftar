import { cn } from "@/lib/utils";

type LinesLoaderProps = {
  className?: string;
  lineClassName?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
};

export function LinesLoader({
  className,
  lineClassName,
  label = "Loading...",
  size = "md",
}: LinesLoaderProps) {
  return (
    <div
      className={cn("lines-loader-wrap", className)}
      data-size={size}
      role="status"
      aria-label={label}
    >
      <div className="lines-loader" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} className={cn("line", lineClassName)} />
        ))}
      </div>
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}
