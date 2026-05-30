"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

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

const variants = {
  default: {
    accent: "from-slate-500/20 via-slate-400/10 to-transparent",
    ring: "ring-slate-400/25",
    iconWrap: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    title: "text-slate-900 dark:text-slate-50",
    desc: "text-slate-600 dark:text-slate-300",
    bar: "bg-slate-500",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="size-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    ),
  },
  success: {
    accent: "from-emerald-500/20 via-emerald-400/10 to-transparent",
    ring: "ring-emerald-400/25",
    iconWrap: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
    title: "text-emerald-950 dark:text-emerald-50",
    desc: "text-emerald-700/90 dark:text-emerald-200/90",
    bar: "bg-emerald-500",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="size-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  error: {
    accent: "from-rose-500/20 via-rose-400/10 to-transparent",
    ring: "ring-rose-400/25",
    iconWrap: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
    title: "text-rose-950 dark:text-rose-50",
    desc: "text-rose-700/90 dark:text-rose-200/90",
    bar: "bg-rose-500",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="size-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
  },
  warning: {
    accent: "from-amber-500/25 via-amber-400/10 to-transparent",
    ring: "ring-amber-400/30",
    iconWrap: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    title: "text-amber-950 dark:text-amber-50",
    desc: "text-amber-700/90 dark:text-amber-200/90",
    bar: "bg-amber-500",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="size-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
  },
};

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
    }, 10000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <Toaster
        position="bottom-right"
        closeButton
        richColors={false}
        expand={false}
        duration={3800}
        toastOptions={{
          classNames: {
            toast:
              "group max-w-[340px] rounded-xl border border-border/70 bg-background/95 px-3 py-2.5 text-foreground shadow-xl shadow-black/10 backdrop-blur-xl dark:shadow-black/40",
            title: "text-[13px] font-bold leading-4 tracking-tight text-foreground",
            description: "text-[11px] leading-4 text-muted-foreground",
            actionButton: "rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground",
            cancelButton: "rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground",
            closeButton: "border-border/70 bg-background/90 text-muted-foreground hover:text-foreground",
          },
        }}
      />
      <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-[360px] flex-col gap-2 sm:bottom-5 sm:right-5">
        {toasts.map((toast) => {
          const v = variants[toast.variant || "default"];

          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto group relative overflow-hidden rounded-2xl border border-white/70 bg-background/92 p-3 shadow-xl shadow-slate-900/10 ring-1 backdrop-blur-xl transition-all duration-300 ease-out dark:border-white/10 dark:bg-slate-950/92 dark:shadow-black/40 ${v.ring}`}
            >
              <div className={`absolute inset-x-0 top-0 h-12 bg-gradient-to-b ${v.accent}`} />
              <div className={`absolute bottom-0 left-0 h-0.5 w-full ${v.bar} opacity-80`} />
              <div className="relative flex items-start gap-2.5">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5 ${v.iconWrap}`}>
                  {v.svg}
                </div>
                <div className="min-w-0 flex-1 pr-1">
                  <strong className={`block text-[13px] font-extrabold leading-4 tracking-tight ${v.title}`}>
                    {toast.title}
                  </strong>
                  {toast.description && (
                    <p className={`mt-0.5 line-clamp-2 text-[12px] leading-4 ${v.desc}`}>
                      {toast.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close notification"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="size-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
