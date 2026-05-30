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
  iconWrap: string;
  ring: string;
  icon: ReactNode;
  label: string;
};

const variants: Record<ToastVariant, ToastVariantConfig> = {
  default: {
    label: "Info",
    iconWrap: "bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20",
    ring: "ring-sky-100/80 dark:ring-sky-400/15",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5Zm0-12a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z" />
      </svg>
    ),
  },
  success: {
    label: "Success",
    iconWrap: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
    ring: "ring-emerald-100/80 dark:ring-emerald-400/15",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.1" stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  error: {
    label: "Error",
    iconWrap: "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20",
    ring: "ring-rose-100/80 dark:ring-rose-400/15",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5Zm8.485 1.515a2.25 2.25 0 0 1-1.948 3.375H5.463a2.25 2.25 0 0 1-1.948-3.375L10.052 5.7a2.25 2.25 0 0 1 3.896 0l6.537 12.315Z" />
      </svg>
    ),
  },
  warning: {
    label: "Warning",
    iconWrap: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
    ring: "ring-amber-100/80 dark:ring-amber-400/15",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5Zm0-12 9 16.5H3L12 4.5Z" />
      </svg>
    ),
  },
};

function ToastCard({ toast, instance, onClose }: { toast: Toast; instance?: HotToastInstance; onClose: () => void }) {
  const variant = variants[toast.variant || "default"];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex w-[min(390px,calc(100vw-24px))] items-start gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 text-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.16)] ring-1 ${variant.ring} transition-all duration-200 dark:border-white/10 dark:bg-slate-950 dark:text-white ${
        instance?.visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-[0.98] opacity-0"
      }`}
      style={{ zIndex: 2147483647 }}
    >
      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${variant.iconWrap}`}>
        {variant.icon}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="truncate text-[14px] font-bold leading-5 tracking-tight text-slate-950 dark:text-white">
          {toast.title || variant.label}
        </div>
        {toast.description ? (
          <div className="mt-0.5 line-clamp-2 text-[12.5px] font-medium leading-5 text-slate-600 dark:text-slate-300">
            {toast.description}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white dark:focus:ring-white/20"
        aria-label="Close notification"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" className="h-4.5 w-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
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
          duration: 4500,
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
        gutter={10}
        containerClassName="!z-[2147483647]"
        containerStyle={{ top: 18, right: 18, zIndex: 2147483647 }}
        toastOptions={{
          duration: 4500,
          style: {
            background: "transparent",
            boxShadow: "none",
            padding: 0,
            maxWidth: "390px",
          },
          success: { iconTheme: { primary: "#059669", secondary: "#ecfdf5" } },
          error: { iconTheme: { primary: "#e11d48", secondary: "#fff1f2" } },
        }}
      />
      <SonnerToaster
        position="top-right"
        closeButton
        richColors
        expand={false}
        duration={4500}
        visibleToasts={5}
        gap={10}
        offset={18}
        className="!z-[2147483646]"
        style={{ zIndex: 2147483646, pointerEvents: "auto" }}
        toastOptions={{
          classNames: {
            toast:
              "!rounded-2xl !border !border-slate-200/80 !bg-white !px-4 !py-3 !text-slate-950 !shadow-[0_18px_45px_rgba(15,23,42,0.16)] dark:!border-white/10 dark:!bg-slate-950 dark:!text-white",
            title: "!text-[14px] !font-bold",
            description: "!text-[12.5px] !font-medium !text-slate-600 dark:!text-slate-300",
            closeButton: "!border-slate-200 !bg-white !text-slate-500 dark:!border-white/10 dark:!bg-slate-900 dark:!text-slate-300",
          },
        }}
      />
    </ToastContext.Provider>
  );
}
