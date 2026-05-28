"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

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
    border: "border-slate-400",
    bg: "bg-slate-50",
    icon: "text-slate-600",
    title: "text-slate-800",
    desc: "text-slate-600",
    darkBorder: "dark:border-slate-500",
    darkBg: "dark:bg-slate-800",
    darkIcon: "dark:text-slate-300",
    darkTitle: "dark:text-slate-100",
    darkDesc: "dark:text-slate-300",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  success: {
    border: "border-green-500",
    bg: "bg-green-50",
    icon: "text-green-700",
    title: "text-green-800",
    desc: "text-green-700",
    darkBorder: "dark:border-green-400",
    darkBg: "dark:bg-green-800",
    darkIcon: "dark:text-green-200",
    darkTitle: "dark:text-green-100",
    darkDesc: "dark:text-green-200",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  error: {
    border: "border-red-500",
    bg: "bg-red-50",
    icon: "text-red-700",
    title: "text-red-800",
    desc: "text-red-700",
    darkBorder: "dark:border-red-400",
    darkBg: "dark:bg-red-800",
    darkIcon: "dark:text-red-200",
    darkTitle: "dark:text-red-100",
    darkDesc: "dark:text-red-200",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  warning: {
    border: "border-amber-500",
    bg: "bg-amber-50",
    icon: "text-amber-700",
    title: "text-amber-800",
    desc: "text-amber-700",
    darkBorder: "dark:border-amber-400",
    darkBg: "dark:bg-amber-800",
    darkIcon: "dark:text-amber-200",
    darkTitle: "dark:text-amber-100",
    darkDesc: "dark:text-amber-200",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
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
          const v = variants[toast.variant || "default"];

          return (
            <div
              key={toast.id}
              role="alert"
              className={`rounded-md border p-4 shadow-sm ${v.border} ${v.bg} ${v.darkBorder} ${v.darkBg}`}
            >
              <div className="flex items-start gap-4">
                <div className={`${v.icon} ${v.darkIcon}`}>
                  {v.svg}
                </div>
                <div className="flex-1">
                  <strong className={`block leading-tight font-medium ${v.title} ${v.darkTitle}`}>
                    {toast.title}
                  </strong>
                  {toast.description && (
                    <p className={`mt-0.5 text-sm ${v.desc} ${v.darkDesc}`}>
                      {toast.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
