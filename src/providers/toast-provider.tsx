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
  card: string;
  title: string;
  description: string;
  iconWrap: string;
  close: string;
  icon: ReactNode;
  label: string;
};

const variants: Record<ToastVariant, ToastVariantConfig> = {
  default: {
    label: "Info",
    card:
      "bg-sky-50/95 text-sky-950 shadow-[0_12px_30px_rgba(2,132,199,0.16)] dark:bg-sky-950/90 dark:text-sky-50 dark:shadow-[0_12px_30px_rgba(2,132,199,0.16)]",
    title: "text-sky-950 dark:text-sky-50",
    description: "text-sky-800/75 dark:text-sky-100/75",
    iconWrap: "bg-sky-500 text-white shadow-[0_6px_14px_rgba(14,165,233,0.28)]",
    close: "text-sky-700/55 hover:bg-sky-100 hover:text-sky-950 dark:text-sky-100/60 dark:hover:bg-sky-900/70 dark:hover:text-white",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path fillRule="evenodd" d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0ZM9 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm1 2a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 10 10Z" clipRule="evenodd" />
      </svg>
    ),
  },
  success: {
    label: "Success",
    card:
      "bg-emerald-50/95 text-emerald-950 shadow-[0_12px_30px_rgba(5,150,105,0.16)] dark:bg-emerald-950/90 dark:text-emerald-50 dark:shadow-[0_12px_30px_rgba(5,150,105,0.16)]",
    title: "text-emerald-950 dark:text-emerald-50",
    description: "text-emerald-800/75 dark:text-emerald-100/75",
    iconWrap: "bg-emerald-500 text-white shadow-[0_6px_14px_rgba(16,185,129,0.28)]",
    close: "text-emerald-700/55 hover:bg-emerald-100 hover:text-emerald-950 dark:text-emerald-100/60 dark:hover:bg-emerald-900/70 dark:hover:text-white",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.31a1 1 0 0 1-1.423 0L3.29 9.23a1 1 0 1 1 1.42-1.408l4.037 4.07 6.54-6.596a1 1 0 0 1 1.416-.006Z" clipRule="evenodd" />
      </svg>
    ),
  },
  error: {
    label: "Error",
    card:
      "bg-rose-50/95 text-rose-950 shadow-[0_12px_30px_rgba(225,29,72,0.16)] dark:bg-rose-950/90 dark:text-rose-50 dark:shadow-[0_12px_30px_rgba(225,29,72,0.16)]",
    title: "text-rose-950 dark:text-rose-50",
    description: "text-rose-800/75 dark:text-rose-100/75",
    iconWrap: "bg-rose-500 text-white shadow-[0_6px_14px_rgba(244,63,94,0.28)]",
    close: "text-rose-700/55 hover:bg-rose-100 hover:text-rose-950 dark:text-rose-100/60 dark:hover:bg-rose-900/70 dark:hover:text-white",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 1 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
      </svg>
    ),
  },
  warning: {
    label: "Warning",
    card:
      "bg-amber-50/95 text-amber-950 shadow-[0_12px_30px_rgba(217,119,6,0.16)] dark:bg-amber-950/90 dark:text-amber-50 dark:shadow-[0_12px_30px_rgba(217,119,6,0.16)]",
    title: "text-amber-950 dark:text-amber-50",
    description: "text-amber-800/75 dark:text-amber-100/75",
    iconWrap: "bg-amber-500 text-white shadow-[0_6px_14px_rgba(245,158,11,0.28)]",
    close: "text-amber-700/55 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-100/60 dark:hover:bg-amber-900/70 dark:hover:text-white",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
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
      className={`pointer-events-auto flex w-[min(312px,calc(100vw-18px))] items-start gap-2.5 overflow-hidden rounded-2xl px-3 py-2.5 transition-all duration-200 ${variant.card} ${
        instance?.visible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-[0.98] opacity-0"
      }`}
    >
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${variant.iconWrap}`}>
        {variant.icon}
      </div>

      <div className="min-w-0 flex-1 pt-px">
        <div className={`truncate text-[13px] font-semibold leading-4 tracking-[-0.01em] ${variant.title}`}>
          {toast.title || variant.label}
        </div>
        {toast.description ? (
          <div className={`mt-0.5 line-clamp-2 text-[11px] font-medium leading-4 ${variant.description}`}>
            {toast.description}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        className={`-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/50 ${variant.close}`}
        aria-label="Close toast"
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
          duration: 3200,
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
        gutter={7}
        containerClassName="!z-[2147483647]"
        containerStyle={{ top: 12, right: 12, zIndex: 2147483647 }}
        toastOptions={{
          duration: 3200,
          style: {
            background: "transparent",
            border: "none",
            boxShadow: "none",
            padding: 0,
            maxWidth: "312px",
          },
        }}
      />
      <SonnerToaster
        position="top-right"
        closeButton
        richColors={false}
        expand={false}
        duration={3200}
        visibleToasts={4}
        gap={7}
        offset={12}
        className="!z-[2147483646]"
        style={{ zIndex: 2147483646, pointerEvents: "auto" }}
        toastOptions={{
          classNames: {
            toast:
              "!w-[min(312px,calc(100vw-18px))] !rounded-2xl !border-0 !px-3 !py-2.5 !shadow-[0_12px_30px_rgba(15,23,42,0.12)] data-[type=success]:!bg-emerald-50/95 data-[type=success]:!text-emerald-950 data-[type=error]:!bg-rose-50/95 data-[type=error]:!text-rose-950 data-[type=warning]:!bg-amber-50/95 data-[type=warning]:!text-amber-950 data-[type=info]:!bg-sky-50/95 data-[type=info]:!text-sky-950 data-[type=default]:!bg-sky-50/95 data-[type=default]:!text-sky-950 dark:data-[type=success]:!bg-emerald-950/90 dark:data-[type=success]:!text-emerald-50 dark:data-[type=error]:!bg-rose-950/90 dark:data-[type=error]:!text-rose-50 dark:data-[type=warning]:!bg-amber-950/90 dark:data-[type=warning]:!text-amber-50 dark:data-[type=info]:!bg-sky-950/90 dark:data-[type=info]:!text-sky-50 dark:data-[type=default]:!bg-sky-950/90 dark:data-[type=default]:!text-sky-50",
            title: "!text-[13px] !font-semibold !leading-4 !tracking-[-0.01em]",
            description: "!line-clamp-2 !text-[11px] !font-medium !leading-4 !opacity-75",
            closeButton:
              "!h-6 !w-6 !border-0 !bg-transparent !text-current !opacity-55 transition hover:!bg-white/35 hover:!opacity-90 dark:hover:!bg-white/10",
          },
        }}
      />
    </ToastContext.Provider>
  );
}
