import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, format: string = "DD/MM/YYYY") {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();

  switch (format) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

export function formatDateTime(date: Date | string) {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function getRuntimeCurrencySettings() {
  if (typeof document === "undefined") {
    return null;
  }

  const root = document.documentElement.dataset;
  return {
    currency: root.currency || "PKR",
    symbol: root.currencySymbol || "Rs",
    position: root.currencyPosition === "right" ? "right" : "left",
    thousandSeparator: root.thousandSeparator || ",",
    decimalSeparator: root.decimalSeparator || ".",
    decimalPlaces: Number.isFinite(Number(root.decimalPlaces))
      ? Math.min(Math.max(Number(root.decimalPlaces), 0), 6)
      : 2,
  };
}

function formatNumberWithSeparators(
  value: number,
  decimalPlaces: number,
  thousandSeparator: string,
  decimalSeparator: string,
) {
  const [integer = "0", decimals = ""] = value.toFixed(decimalPlaces).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
  return decimalPlaces > 0 ? `${grouped}${decimalSeparator}${decimals}` : grouped;
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency?: string,
  symbol?: string,
  position?: "left" | "right",
) {
  const runtime = getRuntimeCurrencySettings();
  const resolvedSymbol = symbol ?? runtime?.symbol ?? "Rs";
  const resolvedPosition = position ?? runtime?.position ?? "left";
  const decimalPlaces = runtime?.decimalPlaces ?? 2;
  const thousandSeparator = runtime?.thousandSeparator ?? ",";
  const decimalSeparator = runtime?.decimalSeparator ?? ".";

  if (amount == null) {
    const zero = formatNumberWithSeparators(0, decimalPlaces, thousandSeparator, decimalSeparator);
    return resolvedPosition === "left" ? `${resolvedSymbol} ${zero}` : `${zero} ${resolvedSymbol}`;
  }
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  const safeValue = Number.isFinite(value) ? value : 0;
  const formatted = formatNumberWithSeparators(
    safeValue,
    decimalPlaces,
    thousandSeparator,
    decimalSeparator,
  );

  return resolvedPosition === "left" ? `${resolvedSymbol} ${formatted}` : `${formatted} ${resolvedSymbol}`;
}

export function taxLabel() {
  if (typeof document === "undefined") return "Tax";
  return document.documentElement.dataset.taxLabel || "Tax";
}

export function generateSku(prefix: string = "CD", length: number = 6): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
}

/**
 * @deprecated Use `reserveNextDocumentNumber` from `@/lib/document-numbers` for sequential IDs.
 * Kept for legacy callers/tests only.
 */
export function generateInvoiceNumber(
  prefix: string = "INV-",
  length: number = 5,
  suffix?: string,
): string {
  const num = String(Math.floor(Math.random() * Math.pow(10, length))).padStart(length, "0");
  return `${prefix}${num}${suffix || ""}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function parseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
