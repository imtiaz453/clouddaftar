"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import hotToast, { Toaster as HotToaster, type Toast as HotToastInstance } from "react-hot-toast";
import { Toaster as SonnerToaster } from "sonner";

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

type ToastVariant = NonNullable<Toast["variant"]>;

type ToastVariantConfig = {
  accent: string;
  dot: string;
  icon: ReactNode;
  label: string;
};

const variants: Record<ToastVariant, ToastVariantConfig> = {
  default: {
    label: "Info",
    accent: "text-sky-600",
    dot: "bg-sky-500",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path fillRule="evenodd" d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0ZM9 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm1 2a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 10 10Z" clipRule="evenodd" />
      </svg>
    ),
  },
  success: {
    label: "Success",
    accent: "text-emerald-600",
    dot: "bg-emerald-500",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.31a1 1 0 0 1-1.423 0L3.29 9.23a1 1 0 1 1 1.42-1.408l4.037 4.07 6.54-6.596a1 1 0 0 1 1.416-.006Z" clipRule="evenodd" />
      </svg>
    ),
  },
  error: {
    label: "Error",
    accent: "text-rose-600",
    dot: "bg-rose-500",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 1 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
      </svg>
    ),
  },
  warning: {
    label: "Warning",
    accent: "text-amber-600",
    dot: "bg-amber-500",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.674 1.167-.168 2.625-1.515 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 10 6Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
    ),
  },
};

function ToastCard({ toast, instance, onClose }: { toast: Toast; instance?: HotToastInstance; onClose: () => void }) {
  const variant = variants[toast.variant || "default"];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex w-[min(326px,calc(100vw-20px))] items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] backdrop-blur transition-all duration-200 dark:border-white/10 dark:bg-slate-950/95 dark:text-white dark:ring-white/[0.06] ${
        instance?.visible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-[0.985] opacity-0"
      }`}
      style={{ zIndex: 2147483647 }}
    >
      <div className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200/70 dark:bg-white/5 dark:ring-white/10">
        <span className={`absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ${variant.dot} ring-2 ring-white dark:ring-slate-950`} />
        <span className={variant.accent}>{variant.icon}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold leading-4 tracking-[-0.01em] text-slate-950 dark:text-white">
          {toast.title || variant.label}
        </div>
        {toast.description ? (
          <div className="mt-0.5 line-clamp-2 text-[11.5px] font-medium leading-4 text-slate-500 dark:text-slate-300">
            {toast.description}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white dark:focus:ring-white/20"
        aria-label="Close notification"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    hotToast.dismiss(id);
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextToast: Toast = { ...toast, id, variant: toast.variant || "default" };

      setToasts((prev) => [...prev.filter((item) => item.id !== id), nextToast]);

      hotToast.custom(
        (instance) => <ToastCard toast={nextToast} instance={instance} onClose={() => removeToast(id)} />,
        {
          id,
          duration: 3400,
          position: "top-right",
        },
      );
    },
    [removeToast],
  );

  const value = useMemo(
    () => ({
      toasts,
      addToast,
      removeToast,
    }),
    [toasts, addToast, removeToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <HotToaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        containerClassName="!z-[2147483647]"
        containerStyle={{ top: 14, right: 14, zIndex: 2147483647 }}
        toastOptions={{
          duration: 3400,
          style: {
            background: "transparent",
            boxShadow: "none",
            padding: 0,
            maxWidth: "326px",
          },
        }}
      />
      <SonnerToaster
        position="top-right"
        closeButton
        richColors={false}
        expand={false}
        duration={3400}
        visibleToasts={4}
        gap={8}
        offset={14}
        className="!z-[2147483646]"
        style={{ zIndex: 2147483646, pointerEvents: "auto" }}
        toastOptions={{
          classNames: {
            toast:
              "!w-[min(326px,calc(100vw-20px))] !rounded-xl !border !border-slate-200/80 !bg-white/95 !px-3 !py-2.5 !text-slate-900 !shadow-[0_10px_28px_rgba(15,23,42,0.12)] !ring-1 !ring-black/[0.03] !backdrop-blur dark:!border-white/10 dark:!bg-slate-950/95 dark:!text-white dark:!ring-white/[0.06]",
            title: "!text-[13px] !font-semibold !leading-4 !tracking-[-0.01em]",
            description: "!line-clamp-2 !text-[11.5px] !font-medium !leading-4 !text-slate-500 dark:!text-slate-300",
            closeButton:
              "!h-6 !w-6 !border-slate-200 !bg-white !text-slate-400 dark:!border-white/10 dark:!bg-slate-900 dark:!text-slate-400",
          },
        }}
      />
    </ToastContext.Provider>
  );
}
