"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const toastVariantStyles = {
  default: {
    icon: Info,
    iconClass: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200",
    cardClass:
      "border-slate-200/80 bg-white/95 text-slate-950 shadow-slate-900/12 dark:border-white/10 dark:bg-slate-950/95 dark:text-slate-100",
    accentClass: "bg-slate-400",
  },
  success: {
    icon: CheckCircle2,
    iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    cardClass:
      "border-emerald-200/90 bg-white/95 text-slate-950 shadow-emerald-900/12 dark:border-emerald-400/20 dark:bg-slate-950/95 dark:text-slate-100",
    accentClass: "bg-emerald-500",
  },
  error: {
    icon: AlertCircle,
    iconClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
    cardClass:
      "border-red-200/90 bg-white/95 text-slate-950 shadow-red-900/12 dark:border-red-400/20 dark:bg-slate-950/95 dark:text-slate-100",
    accentClass: "bg-red-500",
  },
  warning: {
    icon: TriangleAlert,
    iconClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    cardClass:
      "border-amber-200/90 bg-white/95 text-slate-950 shadow-amber-900/12 dark:border-amber-400/20 dark:bg-slate-950/95 dark:text-slate-100",
    accentClass: "bg-amber-500",
  },
} as const;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 11);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 60000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:bottom-5 sm:right-5">
        {toasts.map((toast) => {
          const variant = toast.variant || "default";
          const styles = toastVariantStyles[variant];
          const Icon = styles.icon;

          return (
            <div
              key={toast.id}
              className={cn(
                "relative overflow-hidden rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl transition-all",
                styles.cardClass,
              )}
              role="alert"
            >
              <span className={cn("absolute inset-y-0 left-0 w-1", styles.accentClass)} />
              <div className="flex items-start gap-3 pl-1">
                <span
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    styles.iconClass,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-sm font-semibold leading-5">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      {toast.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition hover:bg-slate-100 hover:text-foreground dark:hover:bg-white/10"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
