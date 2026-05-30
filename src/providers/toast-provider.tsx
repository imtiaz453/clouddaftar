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

type ToastVariantConfig = {
  panel: string;
  icon: JSX.Element;
};

const variants: Record<NonNullable<Toast["variant"]>, ToastVariantConfig> = {
  default: {
    panel: "bg-sky-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
    ),
  },
  success: {
    panel: "bg-green-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 9.75h.008v.008H9V9.75Zm6 0h.008v.008H15V9.75Z" />
      </svg>
    ),
  },
  error: {
    panel: "bg-red-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5Zm8.485 1.515a2.25 2.25 0 0 1-1.948 3.375H5.463a2.25 2.25 0 0 1-1.948-3.375L10.052 5.7a2.25 2.25 0 0 1 3.896 0l6.537 12.315Z" />
      </svg>
    ),
  },
  warning: {
    panel: "bg-yellow-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5m-16.5 4.5h16.5m-12 4.5h7.5m-9.75-13.5 12 18" />
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
    }, 6000);
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
        duration={4200}
        toastOptions={{
          classNames: {
            toast:
              "group relative min-h-[74px] w-[min(600px,calc(100vw-2rem))] overflow-hidden rounded-xl border-0 bg-white py-4 pl-[92px] pr-12 text-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.12)] dark:bg-slate-950 dark:text-slate-50",
            success: "before:absolute before:inset-y-0 before:left-0 before:w-[74px] before:bg-green-500 before:content-['']",
            info: "before:absolute before:inset-y-0 before:left-0 before:w-[74px] before:bg-sky-500 before:content-['']",
            warning: "before:absolute before:inset-y-0 before:left-0 before:w-[74px] before:bg-yellow-400 before:content-['']",
            error: "before:absolute before:inset-y-0 before:left-0 before:w-[74px] before:bg-red-500 before:content-['']",
            icon: "absolute left-0 top-0 z-10 flex h-full w-[74px] items-center justify-center text-white",
            content: "relative z-10 min-w-0 gap-0",
            title: "text-[15px] font-extrabold leading-5 tracking-tight text-slate-950 dark:text-slate-50",
            description: "mt-1 line-clamp-2 text-[14px] leading-5 text-slate-800 dark:text-slate-200",
            actionButton: "rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-slate-950",
            cancelButton: "rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200",
            closeButton:
              "absolute right-4 top-1/2 z-20 h-7 w-7 -translate-y-1/2 rounded-full border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
          },
        }}
      />
      <div className="pointer-events-none fixed bottom-5 right-5 z-[9999] flex w-[calc(100vw-2.5rem)] max-w-[600px] flex-col gap-4">
        {toasts.map((toast) => {
          const v = variants[toast.variant || "default"];

          return (
            <div
              key={toast.id}
              role="alert"
              className="pointer-events-auto relative min-h-[74px] overflow-hidden rounded-xl bg-white py-4 pl-[92px] pr-12 text-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.12)] transition-all duration-300 ease-out dark:bg-slate-950 dark:text-slate-50"
            >
              <div className={`absolute inset-y-0 left-0 flex w-[74px] items-center justify-center text-white ${v.panel}`}>
                {v.icon}
              </div>

              <div className="min-w-0">
                <strong className="block text-[15px] font-extrabold leading-5 tracking-tight text-slate-950 dark:text-slate-50">
                  {toast.title}
                </strong>
                {toast.description && (
                  <p className="mt-1 line-clamp-2 text-[14px] leading-5 text-slate-800 dark:text-slate-200">
                    {toast.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="absolute right-4 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Close notification"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" className="size-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
