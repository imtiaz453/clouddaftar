"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Toaster, toast as sonnerToast } from "sonner";

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
  panel: string;
  icon: ReactNode;
  label: string;
};

const variants: Record<ToastVariant, ToastVariantConfig> = {
  default: {
    label: "Info",
    panel: "bg-sky-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5Zm0-12a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z" />
      </svg>
    ),
  },
  success: {
    label: "Success",
    panel: "bg-emerald-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.1" stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  error: {
    label: "Error",
    panel: "bg-rose-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5Zm8.485 1.515a2.25 2.25 0 0 1-1.948 3.375H5.463a2.25 2.25 0 0 1-1.948-3.375L10.052 5.7a2.25 2.25 0 0 1 3.896 0l6.537 12.315Z" />
      </svg>
    ),
  },
  warning: {
    label: "Warning",
    panel: "bg-amber-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5Zm0-12 9 16.5H3L12 4.5Z" />
      </svg>
    ),
  },
};

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const variant = variants[toast.variant || "default"];

  return (
    <div
      role="alert"
      className="pointer-events-auto grid w-[min(520px,calc(100vw-24px))] grid-cols-[72px_1fr_44px] overflow-hidden rounded-[18px] border border-black/5 bg-white text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:ring-white/10"
      style={{ zIndex: 2147483647 }}
    >
      <div className={`flex min-h-[72px] items-center justify-center text-white ${variant.panel}`}>
        {variant.icon}
      </div>

      <div className="min-w-0 py-3.5 pl-4 pr-2">
        <div className="truncate text-[15px] font-extrabold leading-5 tracking-tight text-slate-950 dark:text-white">
          {toast.title || variant.label}
        </div>
        {toast.description ? (
          <div className="mt-1 line-clamp-2 text-[13px] font-medium leading-5 text-slate-600 dark:text-slate-300">
            {toast.description}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="m-2 inline-flex h-8 w-8 items-center justify-center self-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white dark:focus:ring-white/20"
        aria-label="Close notification"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" className="h-5 w-5">
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
    sonnerToast.dismiss(id);
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextToast: Toast = { ...toast, id, variant: toast.variant || "default" };

      setToasts((prev) => [...prev.filter((item) => item.id !== id), nextToast]);

      sonnerToast.custom(
        () => <ToastCard toast={nextToast} onClose={() => removeToast(id)} />,
        {
          id,
          duration: 5200,
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
      <Toaster
        position="top-right"
        closeButton={false}
        expand={false}
        duration={5200}
        visibleToasts={6}
        gap={12}
        offset={18}
        className="!z-[2147483647]"
        style={{ zIndex: 2147483647, pointerEvents: "auto" }}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: "!bg-transparent !p-0 !shadow-none !border-0",
          },
        }}
      />
    </ToastContext.Provider>
  );
}
