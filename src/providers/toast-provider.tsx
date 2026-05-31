"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import hotToast, {
  Toaster as HotToaster,
  type Toast as HotToastInstance,
} from "react-hot-toast";
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
  bg: string;
  title: string;
  description: string;
  iconBg: string;
  iconText: string;
  close: string;
  label: string;
  icon: ReactNode;
};

const variants: Record<ToastVariant, ToastVariantConfig> = {
  default: {
    label: "Info",
    bg: "bg-sky-50/50 dark:bg-sky-950/50",
    title: "text-sky-950 dark:text-sky-50",
    description: "text-sky-800/75 dark:text-sky-100/75",
    iconBg: "bg-sky-500/15 dark:bg-sky-300/15",
    iconText: "text-sky-700 dark:text-sky-200",
    close: "text-sky-800/45 hover:bg-sky-500/10 hover:text-sky-950 dark:text-sky-100/45 dark:hover:bg-sky-200/10 dark:hover:text-sky-50",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path fillRule="evenodd" d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0ZM9 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm1 2a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 10 10Z" clipRule="evenodd" />
      </svg>
    ),
  },
  success: {
    label: "Success",
    bg: "bg-emerald-500/20 dark:bg-emerald-500/25",
    title: "text-emerald-950 dark:text-emerald-50",
    description: "text-emerald-800/75 dark:text-emerald-100/75",
    iconBg: "bg-emerald-500/15 dark:bg-emerald-300/15",
    iconText: "text-emerald-700 dark:text-emerald-200",
    close: "text-emerald-800/45 hover:bg-emerald-500/10 hover:text-emerald-950 dark:text-emerald-100/45 dark:hover:bg-emerald-200/10 dark:hover:text-emerald-50",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.31a1 1 0 0 1-1.423 0L3.29 9.23a1 1 0 1 1 1.42-1.408l4.037 4.07 6.54-6.596a1 1 0 0 1 1.416-.006Z" clipRule="evenodd" />
      </svg>
    ),
  },
  error: {
    label: "Error",
    bg: "bg-rose-500/20 dark:bg-rose-500/25",
    title: "text-rose-950 dark:text-rose-50",
    description: "text-rose-800/75 dark:text-rose-100/75",
    iconBg: "bg-rose-500/15 dark:bg-rose-300/15",
    iconText: "text-rose-700 dark:text-rose-200",
    close: "text-rose-800/45 hover:bg-rose-500/10 hover:text-rose-950 dark:text-rose-100/45 dark:hover:bg-rose-200/10 dark:hover:text-rose-50",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 1 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
      </svg>
    ),
  },
  warning: {
    label: "Warning",
    bg: "bg-amber-400/25 dark:bg-amber-500/25",
    title: "text-amber-950 dark:text-amber-50",
    description: "text-amber-800/75 dark:text-amber-100/75",
    iconBg: "bg-amber-500/15 dark:bg-amber-300/15",
    iconText: "text-amber-700 dark:text-amber-200",
    close: "text-amber-800/45 hover:bg-amber-500/10 hover:text-amber-950 dark:text-amber-100/45 dark:hover:bg-amber-200/10 dark:hover:text-amber-50",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.674 1.167-.168 2.625-1.515 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 10 6Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
    ),
  },
};

function ToastCard({
  toast,
  instance,
  onClose,
}: {
  toast: Toast;
  instance?: HotToastInstance;
  onClose: () => void;
}) {
  const variant = variants[toast.variant || "default"];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex w-[min(312px,calc(100vw-20px))] items-center gap-2.5 rounded-2xl ${variant.bg} px-3 py-2.5 shadow-[0_12px_30px_rgba(15,23,42,0.14)] backdrop-blur-sm transition-all duration-1000 dark:shadow-[0_12px_30px_rgba(0,0,0,0.32)] ${
        instance?.visible ? "translate-y-0 scale-100 opacity-400" : "-translate-y-1 scale-[0.985] opacity-0"
      }`}
      style={{ zIndex: 2147483647 }}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${variant.iconBg} ${variant.iconText}`}
        aria-hidden="true"
      >
        {variant.icon}
      </div>

      <div className="min-w-0 flex-1 self-center">
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
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-current/15 ${variant.close}`}
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
          duration: 10000,
          position: "bottom-right",
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
          duration: 10000,
          style: {
            background: "transparent",
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
        duration={10000}
        visibleToasts={4}
        gap={8}
        offset={14}
        className="!z-[2147483646]"
        style={{ zIndex: 2147483646, pointerEvents: "auto" }}
        toastOptions={{
          classNames: {
            toast:
              "!w-[min(312px,calc(100vw-20px))] !rounded-2xl !border-0 !bg-slate-50/50 !px-3 !py-2.5 !text-slate-900 !shadow-[0_12px_30px_rgba(15,23,42,0.14)] !backdrop-blur-sm dark:!bg-slate-950/50 dark:!text-white dark:!shadow-[0_12px_30px_rgba(0,0,0,0.32)]",
            title: "!text-[13px] !font-semibold !leading-4 !tracking-[-0.01em]",
            description: "!line-clamp-2 !text-[11px] !font-medium !leading-4 !text-slate-600 dark:!text-slate-300",
            closeButton:
              "!h-6 !w-6 !border-0 !bg-transparent !text-slate-500 hover:!bg-slate-900/10 dark:!text-slate-300 dark:hover:!bg-white/10",
            success: "!bg-emerald-500/20 dark:!bg-emerald-500/25",
            warning: "!bg-amber-400/25 dark:!bg-amber-500/25",
            error: "!bg-rose-500/20 dark:!bg-rose-500/25",
          },
        }}
      />
    </ToastContext.Provider>
  );
}
