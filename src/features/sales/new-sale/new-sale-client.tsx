"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/providers/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Search,
  Plus,
  Trash2,
  Barcode,
  Save,
  Check,
  ShoppingCart,
  Menu,
  Home,
  Wifi,
  UserCircle,
  RotateCcw,
  Star,
  FilePlus2,
  FileText,
  Percent,
  CreditCard,
  Delete,
  Maximize2,
  Minimize2,
  Printer,
  X,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, taxLabel } from "@/lib/utils";
import { dashboardHref } from "@/lib/dashboard-href";
import {
  type LineItem,
  type ProductOption,
  calculateTotals,
} from "@/components/shared/line-item-editor";
import {
  openThermalInvoicePrintWindow,
  printThermalInvoiceViaBridge,
  printThermalInvoice,
  thermalInvoicePrintUrl,
} from "@/features/sales/print-utils";

type KeypadMode = "qty" | "discount" | "price" | "payment";

const DECIMAL_QTY_UNITS = new Set([
  "kg", "kilogram", "g", "gram", "l", "liter", "ml", "milliliter",
  "m", "meter", "cm", "centimeter", "ft", "feet", "in", "inch",
  "lb", "pound", "oz", "ounce",
]);

function allowsDecimalQty(unit: string): boolean {
  return DECIMAL_QTY_UNITS.has(unit?.toLowerCase());
}

function posLineSubtotal(item: LineItem): number {
  return item.price * item.quantity;
}

function posDiscountAmount(item: LineItem): number {
  return posLineSubtotal(item) * (item.discount / 100);
}

function posLineTax(item: LineItem): number {
  const taxable = posLineSubtotal(item) - posDiscountAmount(item);
  return taxable * (item.tax / 100);
}

function posLineTotal(item: LineItem): number {
  return posLineSubtotal(item) - posDiscountAmount(item) + posLineTax(item);
}

function computePosTotals(items: LineItem[], globalDiscount: number) {
  const subtotal = items.reduce((s, i) => s + posLineSubtotal(i), 0);
  const itemDiscount = items.reduce((s, i) => s + posDiscountAmount(i), 0);
  const discountTotal = globalDiscount + itemDiscount;
  const vatTotal = items.reduce((s, i) => s + posLineTax(i), 0);
  const grandTotal = subtotal - discountTotal + vatTotal;
  return { subtotal, discountTotal, vatTotal, grandTotal, itemCount: items.length };
}

interface NewSaleClientProps {
  products: ProductOption[];
  customers: { id: string; name: string }[];
  categories?: { id: string; name: string; color?: string | null }[];
  defaultTaxRate?: number;
  taxComplianceMode?: string;
}

let nextId = 1;
function createRowId(): string {
  return `pos_${nextId++}`;
}

function createEmptyRow(): LineItem {
  return {
    id: createRowId(),
    productId: "",
    productName: "",
    sku: "",
    barcode: "",
    unit: "",
    quantity: 1,
    price: 0,
    discount: 0,
    tax: 0,
    stock: 0,
    description: "",
  };
}

export function NewSaleClient({
  products,
  customers,
  categories = [],
  defaultTaxRate,
  taxComplianceMode = "NONE",
}: NewSaleClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LineItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paid, setPaid] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [buyerTaxNumber, setBuyerTaxNumber] = useState("");

  const [keypadMode, setKeypadMode] = useState<KeypadMode>("qty");
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [keypadBuffer, setKeypadBuffer] = useState("1");
  const [refundMode, setRefundMode] = useState(false);

  const [mobileTab, setMobileTab] = useState<"cart" | "products">("cart");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenPrintSaleId, setFullscreenPrintSaleId] = useState<string | null>(null);
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null);
  const posShellRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const receiptFrameRef = useRef<HTMLIFrameElement>(null);
  const autoPaid = useRef(true);
  const keypadModeRef = useRef(keypadMode);
  keypadModeRef.current = keypadMode;
  const activeLineIdRef = useRef(activeLineId);
  activeLineIdRef.current = activeLineId;

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === posShellRef.current);
      requestAnimationFrame(() => barcodeRef.current?.focus());
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!fullscreenNotice) return;
    const timer = window.setTimeout(() => setFullscreenNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [fullscreenNotice]);

  const totals = useMemo(() => computePosTotals(items, globalDiscount), [items, globalDiscount]);

  useEffect(() => {
    if (autoPaid.current) {
      setPaid(String(totals.grandTotal));
      setKeypadBuffer(String(totals.grandTotal));
    }
  }, [totals.grandTotal]);

  const amountPaid = Math.max(0, parseFloat(paid) || 0);
  const change = amountPaid - totals.grandTotal;
  const balanceDue = Math.max(0, totals.grandTotal - amountPaid);
  const invoiceFullyPaid = totals.grandTotal > 0 && amountPaid >= totals.grandTotal;
  const validItems = items.filter((i) => i.productId && i.quantity > 0);

  useEffect(() => {
    if (invoiceFullyPaid && dueDate) setDueDate("");
  }, [invoiceFullyPaid, dueDate]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (activeCategory) {
      filtered = filtered.filter((p) => p.categoryId === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)),
      );
    }
    return filtered;
  }, [products, activeCategory, searchQuery]);

  const uniqueCategories = useMemo(() => {
    const catMap = new Map<string, { id: string; name: string; color?: string | null }>();
    for (const c of categories) {
      catMap.set(c.id, c);
    }
    return Array.from(catMap.values());
  }, [categories]);

  const activeItem = useMemo(
    () => items.find((i) => i.id === activeLineId) ?? null,
    [items, activeLineId],
  );

  const syncBuffer = useCallback((buffer: string) => {
    const mode = keypadModeRef.current;
    const lineId = activeLineIdRef.current;

    if (mode === "payment") {
      const v = Math.max(0, parseFloat(buffer) || 0);
      setPaid(String(v));
      autoPaid.current = false;
      return;
    }

    if (!lineId) return;

    if (mode === "qty") {
      const raw = parseFloat(buffer);
      const v = Number.isNaN(raw) || raw < 0 ? 1 : Math.max(1, raw);
      setItems((prev) =>
        prev.map((item) =>
          item.id === lineId
            ? { ...item, quantity: allowsDecimalQty(item.unit) ? v : Math.round(v) }
            : item,
        ),
      );
    } else if (mode === "discount") {
      const raw = parseFloat(buffer);
      const v = Number.isNaN(raw) ? 0 : Math.min(100, Math.max(0, raw));
      setItems((prev) =>
        prev.map((item) =>
          item.id === lineId ? { ...item, discount: Math.round(v * 100) / 100 } : item,
        ),
      );
    } else if (mode === "price") {
      const raw = parseFloat(buffer);
      const v = Number.isNaN(raw) ? 0 : Math.max(0, raw);
      setItems((prev) =>
        prev.map((item) =>
          item.id === lineId ? { ...item, price: Math.round(v * 100) / 100 } : item,
        ),
      );
    }
  }, []);

  const preloadBuffer = useCallback(
    (mode: KeypadMode, item: LineItem | null) => {
      if (mode === "payment") {
        const val = paid || "0";
        setKeypadBuffer(val);
        return;
      }
      if (!item) {
        setKeypadBuffer("");
        return;
      }
      if (mode === "qty") setKeypadBuffer(String(item.quantity));
      else if (mode === "discount") setKeypadBuffer(String(item.discount));
      else if (mode === "price") setKeypadBuffer(String(item.price));
    },
    [paid],
  );

  function switchMode(mode: KeypadMode) {
    setKeypadMode(mode);
    preloadBuffer(mode, activeItem);
  }

  function handleKeypad(value: string) {
    const mode = keypadModeRef.current;
    const lineId = activeLineIdRef.current;

    if (value === "back") {
      setKeypadBuffer((prev) => {
        const next = prev.slice(0, -1);
        if (next === "" || next === "-") {
          const fallback = mode === "qty" ? "1" : "0";
          syncBuffer(fallback);
          return fallback;
        }
        syncBuffer(next);
        return next;
      });
      return;
    }

    if (value === "clear") {
      const reset = mode === "qty" ? "1" : "0";
      setKeypadBuffer(reset);
      syncBuffer(reset);
      return;
    }

    if (value === ".") {
      if (mode === "qty" && lineId) {
        const item = items.find((i) => i.id === lineId);
        if (item && !allowsDecimalQty(item.unit)) return;
      }
      setKeypadBuffer((prev) => {
        if (prev.includes(".")) return prev;
        const next = prev + ".";
        syncBuffer(next);
        return next;
      });
      return;
    }

    if (value === "+/-") {
      if (!refundMode) return;
      if (mode !== "qty") return;
      setKeypadBuffer((prev) => {
        const next = prev.startsWith("-") ? prev.slice(1) : "-" + prev;
        syncBuffer(next);
        return next;
      });
      return;
    }

    setKeypadBuffer((prev) => {
      const next = prev + value;
      syncBuffer(next);
      return next;
    });
  }

  function addProductToCart(product: ProductOption) {
    setItems((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && item.productId,
      );
      if (existing) {
        setActiveLineId(existing.id);
        setKeypadMode("qty");
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      const taxRate = product.tax != null ? Number(product.tax) : defaultTaxRate || 0;
      const id = createRowId();
      const newItem: LineItem = {
        id,
        productId: product.id,
        productName: product.name,
        sku: product.sku || "",
        barcode: product.barcode || "",
        unit: product.unit || "",
        quantity: 1,
        price: Number(product.sellingPrice) || 0,
        discount: 0,
        tax: taxRate,
        stock: product.stock || 0,
        description: "",
      };
      setActiveLineId(id);
      setKeypadMode("qty");
      return [...prev, newItem];
    });
  }

  useEffect(() => {
    if (activeLineId) {
      const item = items.find((i) => i.id === activeLineId);
      preloadBuffer(keypadMode, item ?? null);
    }
  }, [activeLineId, keypadMode, items, preloadBuffer]);

  useEffect(() => {
    const barcode = barcodeInput.trim();
    if (barcode.length > 0) {
      const product = products.find(
        (p) =>
          p.barcode?.trim().toLowerCase() === barcode.toLowerCase() &&
          p.isActive !== false &&
          p.isService !== true,
      );
      if (product) {
        addProductToCart(product);
        setBarcodeInput("");
        requestAnimationFrame(() => barcodeRef.current?.focus());
      }
    }
  }, [barcodeInput, products]);

  function removeCartItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (activeLineId === id) {
      setActiveLineId(null);
    }
  }

  function handleCustomerChange(value: string) {
    if (value === "__create_customer__") {
      window.location.assign(dashboardHref(pathname, "/customers"));
      return;
    }
    setCustomerId(value);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (posShellRef.current?.requestFullscreen) {
        await posShellRef.current.requestFullscreen();
      } else {
        addToast({
          title: "Fullscreen is not available in this browser",
          variant: "error",
        });
      }
    } catch {
      addToast({
        title: "Could not switch fullscreen mode",
        variant: "error",
      });
    }
  }

  function printFullscreenReceipt() {
    if (fullscreenPrintSaleId && document.fullscreenElement) {
      void document.exitFullscreen().finally(() => {
        printThermalInvoice(fullscreenPrintSaleId, null);
        setFullscreenPrintSaleId(null);
      });
      return;
    }
    const frameWindow = receiptFrameRef.current?.contentWindow;
    if (!frameWindow) return;
    frameWindow.focus();
    frameWindow.print();
  }

  function handlePaidInFull() {
    const val = String(totals.grandTotal);
    setPaid(val);
    setKeypadBuffer(val);
    autoPaid.current = false;
  }

  async function handleSubmit(status: string) {
    if (validItems.length === 0) {
      addToast({ title: "Add at least one product", variant: "error" });
      return;
    }
    if (status === "COMPLETED" && amountPaid < totals.grandTotal) {
      const proceed = window.confirm(
        `Paid amount (${formatCurrency(amountPaid)}) is less than total (${formatCurrency(totals.grandTotal)}). Complete sale as partial payment?`,
      );
      if (!proceed) return;
    }

    const keepFullscreen = document.fullscreenElement === posShellRef.current;
    const printWindow =
      status === "DRAFT" || keepFullscreen
        ? null
        : openThermalInvoicePrintWindow();
    setLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          items: validItems.map((item) => {
            const sub = posLineSubtotal(item);
            const discAmt = sub * (item.discount / 100);
            return {
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              discount: discAmt,
              tax: item.tax,
              description: item.description || undefined,
            };
          }),
          discount: globalDiscount,
          paymentMethod,
          notes: notes || undefined,
          terms: terms || undefined,
          paid: amountPaid,
          dueDate: invoiceFullyPaid ? null : dueDate || null,
          status,
          taxComplianceMode,
          buyerTaxNumber: buyerTaxNumber || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const saleId = data.data?.id;

      const msg =
        status === "DRAFT"
          ? "Draft saved"
          : `Sale completed: Invoice ${data.data?.invoiceNumber}`;
      if (keepFullscreen) {
        setFullscreenNotice(msg);
      } else {
        addToast({
          title: status === "DRAFT" ? "Draft saved" : "Sale completed",
          description: `Invoice ${data.data?.invoiceNumber}`,
          variant: "success",
        });
      }

      setItems([]);
      setActiveLineId(null);
      setCustomerId("");
      setPaid("");
      setKeypadBuffer("1");
      setKeypadMode("qty");
      setDueDate("");
      autoPaid.current = true;
      setNotes("");
      setTerms("");
      setGlobalDiscount(0);
      setSearchQuery("");
      setActiveCategory(null);
      setBuyerTaxNumber("");
      setRefundMode(false);

      if (status !== "DRAFT" && saleId && keepFullscreen) {
        const bridgeResult = await printThermalInvoiceViaBridge(saleId);
        if (bridgeResult.ok) {
          setFullscreenNotice(
            `Invoice ${data.data?.invoiceNumber} sent to thermal printer`,
          );
        } else {
          setFullscreenNotice(bridgeResult.error || "Thermal bridge unavailable");
          setFullscreenPrintSaleId(saleId);
        }
      } else if (status !== "DRAFT" && saleId) {
        printThermalInvoice(saleId, printWindow);
      } else {
        printWindow?.close();
      }

      if (!keepFullscreen) {
        router.refresh();
        router.push(dashboardHref(pathname, "/sales"));
      }
    } catch (err) {
      printWindow?.close();
      addToast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Something went wrong",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const selectedItem = items.find((item) => item.id === activeLineId) || null;
  const categoryName =
    activeCategory === null
      ? "All Products"
      : uniqueCategories.find((c) => c.id === activeCategory)?.name || "Products";
  const keypadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "+/-", "0", ".", "back"];

  const modeLabel =
    keypadMode === "qty"
      ? "Editing Qty"
      : keypadMode === "discount"
        ? "Editing Discount %"
        : keypadMode === "price"
          ? "Editing Price"
          : "Entering Payment";

  const modeColor =
    keypadMode === "qty"
      ? "bg-blue-100 text-blue-800"
      : keypadMode === "discount"
        ? "bg-amber-100 text-amber-800"
        : keypadMode === "price"
          ? "bg-violet-100 text-violet-800"
          : "bg-emerald-100 text-emerald-800";

  return (
    <div
      ref={posShellRef}
      className={`relative flex flex-col overflow-hidden border bg-slate-100 shadow-sm ${
        isFullscreen
          ? "h-screen rounded-none"
          : "h-[calc(100vh-4rem)] rounded-xl"
      }`}
    >
      {isFullscreen && fullscreenNotice && (
        <div className="absolute left-1/2 top-4 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-xl">
          <Check className="h-4 w-4" />
          {fullscreenNotice}
        </div>
      )}

      <div className="flex h-14 items-center gap-2 border-b bg-white/95 px-3 sm:h-16 sm:gap-4 sm:px-4">
        <div className="min-w-0">
          <div className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {refundMode ? "Point of Sale — Refund Mode" : "Point of Sale"}
          </div>
          <div className="hidden text-xs text-muted-foreground sm:block">
            {refundMode
              ? "Processing returns and refunds"
              : "Invoice checkout, customer, tax, notes, and terms"}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="rounded-lg border bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
            Lines {validItems.length}
          </span>
          <span className="rounded-lg border bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
            {taxLabel()} {formatCurrency(totals.vatTotal)}
          </span>
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            Total {formatCurrency(totals.grandTotal)}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
          <Wifi className="h-4 w-4 text-emerald-600" />
          <UserCircle className="h-6 w-6 text-primary" />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-primary transition hover:bg-primary/10"
            title={isFullscreen ? "Exit full screen" : "Full screen"}
            aria-label={isFullscreen ? "Exit full screen" : "Open full screen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          <Menu className="h-5 w-5" />
        </div>
      </div>

      <div className="flex h-10 shrink-0 border-b bg-white md:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("cart")}
          className={`flex-1 cursor-pointer text-sm font-semibold transition ${
            mobileTab === "cart"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Cart {validItems.length > 0 ? `(${validItems.length})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("products")}
          className={`flex-1 cursor-pointer text-sm font-semibold transition ${
            mobileTab === "products"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Products
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[42%_58%]">
        <section
          className={`flex min-h-0 flex-col border-r bg-white ${
            mobileTab !== "cart" ? "hidden" : ""
          } md:flex`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                <div>
                  <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="font-medium text-foreground">Start an order</p>
                  <p>Scan a barcode or tap a product tile.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {items.map((item) => {
                  const isActive = item.id === activeLineId;
                  const qty = item.quantity;
                  const sub = posLineSubtotal(item);
                  const discAmt = posDiscountAmount(item);
                  const lineTotal = posLineTotal(item);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveLineId(item.id);
                        preloadBuffer(keypadMode, item);
                      }}
                      role="button"
                      tabIndex={0}
                      className={`grid w-full grid-cols-[1fr_auto] gap-3 px-4 py-3 text-left transition ${
                        isActive
                          ? "bg-primary/10 ring-1 ring-primary/20"
                          : "cursor-pointer hover:bg-muted/60"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {item.productName}
                        </span>
                        <span className="mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {isActive && keypadMode === "qty" ? (
                            <span className="font-semibold text-blue-700">
                              Qty: {keypadBuffer || "1"}
                            </span>
                          ) : (
                            <span>Qty: {qty}</span>
                          )}
                          {isActive && keypadMode === "price" ? (
                            <span className="font-semibold text-violet-700">
                              Price: {formatCurrency(parseFloat(keypadBuffer) || 0)}
                            </span>
                          ) : (
                            <span>Price: {formatCurrency(item.price)}</span>
                          )}
                          {isActive && keypadMode === "discount" ? (
                            <span className="font-semibold text-amber-700">
                              Disc: {keypadBuffer || "0"}%
                            </span>
                          ) : (
                            <span>
                              Disc: {item.discount}%
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {item.unit || "Units"} x {formatCurrency(item.price)}
                          {discAmt > 0 && (
                            <span className="ml-2 text-amber-600">
                              -{formatCurrency(discAmt)}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="flex items-start gap-2">
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCartItem(item.id);
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${item.productName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t bg-[#f5f6f7]">
            <div className="px-4 py-3 text-right">
              <p className="text-xs text-muted-foreground">
                {taxLabel()}: {formatCurrency(totals.vatTotal)}
              </p>
              <p className="text-2xl font-bold">
                Total: {formatCurrency(totals.grandTotal)}
              </p>
            </div>

            <div className="grid grid-cols-6 border-y bg-white text-xs font-medium text-muted-foreground">
              <ToolbarButton
                icon={RotateCcw}
                label={refundMode ? "Cancel Refund" : "Refund"}
                onClick={() => {
                  if (refundMode) {
                    setRefundMode(false);
                  } else {
                    const ok = window.confirm(
                      "Switch to refund mode? Quantities will become negative.",
                    );
                    if (ok) setRefundMode(true);
                  }
                }}
                active={refundMode}
              />
              <ToolbarButton icon={FileText} label="Note" onClick={() => {}} />
              <ToolbarButton
                icon={Barcode}
                label="Barcode"
                onClick={() => barcodeRef.current?.focus()}
              />
              <ToolbarButton icon={Star} label="Loyalty" onClick={() => {}} />
              <ToolbarButton icon={FilePlus2} label="Order" onClick={() => {}} />
              <ToolbarButton
                icon={CreditCard}
                label="Cash"
                onClick={() => setPaymentMethod("CASH")}
              />
            </div>

            <div className="border-t bg-white px-3 py-2">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${modeColor}`}
                >
                  {modeLabel}
                </span>
                {refundMode && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-800">
                    Refund Mode
                  </span>
                )}
              </div>
              <div className="mb-2 flex gap-1">
                <ModeButton
                  active={keypadMode === "qty"}
                  label="Qty"
                  disabled={!activeLineId}
                  onClick={() => switchMode("qty")}
                />
                <ModeButton
                  active={keypadMode === "discount"}
                  label="% Disc"
                  icon={Percent}
                  disabled={!activeLineId}
                  onClick={() => switchMode("discount")}
                />
                <ModeButton
                  active={keypadMode === "price"}
                  label="Price"
                  disabled={!activeLineId}
                  onClick={() => switchMode("price")}
                />
                <ModeButton
                  active={keypadMode === "payment"}
                  label="Payment"
                  onClick={() => switchMode("payment")}
                />
              </div>
              <div className="grid grid-cols-4">
                {keypadKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypad(key)}
                    disabled={
                      key === "+/-" && !refundMode
                    }
                    className="flex h-10 items-center justify-center border-b border-l text-sm font-semibold hover:bg-[#e7f2f2] disabled:opacity-30 sm:h-12 sm:text-base"
                  >
                    {key === "back" ? (
                      <Delete className="h-4 w-4" />
                    ) : key === "+/-" ? (
                      <Minus className="h-4 w-4" />
                    ) : (
                      key
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleKeypad("clear")}
                  className="col-span-4 flex h-8 items-center justify-center border-b border-l text-[11px] font-semibold uppercase text-muted-foreground hover:bg-red-50 hover:text-red-600 sm:h-9"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="border-t bg-white">
              <div className="grid grid-cols-[35%_65%]">
                <div className="flex flex-col">
                  <Select
                    value={customerId}
                    onValueChange={handleCustomerChange}
                  >
                    <SelectTrigger className="h-12 rounded-none border-0 border-b bg-white text-sm">
                      <SelectValue placeholder="Walk-in Customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__create_customer__">
                        Create new customer
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => handleSubmit("COMPLETED")}
                    disabled={
                      loading || validItems.length === 0 || amountPaid <= 0
                    }
                    className="flex min-h-[80px] flex-1 items-center justify-center bg-[#7c4d72] px-3 text-lg font-bold text-white transition hover:bg-[#6d4364] disabled:opacity-50 sm:min-h-[100px]"
                  >
                    {loading && <LoadingSpinner size={5} className="mr-2" />}
                    Complete Sale
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1 border-l p-2 text-xs">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Method
                    </span>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="h-8 rounded border border-input bg-background px-1 text-xs"
                    >
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="MOBILE_PAYMENT">Mobile Payment</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Paid
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paid}
                      onFocus={() => switchMode("payment")}
                      onChange={(e) => {
                        autoPaid.current = false;
                        const v = e.target.value;
                        if (/^\d*\.?\d*$/.test(v) || v === "") {
                          setPaid(v);
                          setKeypadBuffer(v);
                        }
                      }}
                      className="h-8 rounded border border-input bg-background px-1.5 text-right text-xs font-medium"
                    />
                  </label>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      &nbsp;
                    </span>
                    <button
                      type="button"
                      onClick={handlePaidInFull}
                      disabled={validItems.length === 0}
                      className="h-8 rounded border border-emerald-300 bg-emerald-50 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                    >
                      Paid in Full
                    </button>
                  </div>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Due Date
                    </span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      disabled={invoiceFullyPaid}
                      className="h-8 rounded border border-input bg-background px-1 text-xs disabled:opacity-50"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Disc %
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={globalDiscount}
                      onChange={(e) =>
                        setGlobalDiscount(parseFloat(e.target.value) || 0)
                      }
                      className="h-8 rounded border border-input bg-background px-1 text-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Notes
                    </span>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notes"
                      className="h-8 rounded border border-input bg-background px-1 text-xs"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t px-3 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSubmit("DRAFT")}
                  disabled={loading || validItems.length === 0}
                  className="h-8 text-xs"
                >
                  <Save className="mr-1 h-3.5 w-3.5" />
                  Draft
                </Button>
                <div className="flex-1" />
                {balanceDue > 0 ? (
                  <span className="text-xs font-semibold text-red-600">
                    Balance: {formatCurrency(balanceDue)}
                  </span>
                ) : change > 0 ? (
                  <span className="text-xs font-semibold text-emerald-600">
                    Change: {formatCurrency(change)}
                  </span>
                ) : null}
              </div>

              {taxComplianceMode !== "NONE" && (
                <div className="border-t px-3 py-2">
                  <input
                    type="text"
                    placeholder={`Buyer ${taxComplianceMode === "ZATCA" ? "VAT No." : "NTN"}`}
                    value={buyerTaxNumber}
                    onChange={(e) => setBuyerTaxNumber(e.target.value)}
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          className={`flex min-h-0 flex-col bg-[#d8dbde] ${
            mobileTab !== "products" ? "hidden" : ""
          } md:flex`}
        >
          <div className="flex flex-wrap items-center gap-2 border-b bg-white px-3 py-2">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Home className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground">›</span>
            <span className="min-w-0 truncate text-sm font-semibold">
              {categoryName}
            </span>
            <div className="relative ml-auto w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search product"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="relative w-full sm:w-44">
              <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={barcodeRef}
                type="text"
                placeholder="Scan barcode"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b bg-white px-1.5 py-2 sm:px-3">
            <CategoryButton
              active={activeCategory === null}
              label="All"
              onClick={() => setActiveCategory(null)}
            />
            {uniqueCategories.map((category) => (
              <CategoryButton
                key={category.id}
                active={activeCategory === category.id}
                label={category.name}
                onClick={() => setActiveCategory(category.id)}
              />
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {filteredProducts.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-lg bg-white text-sm text-muted-foreground">
                {searchQuery
                  ? "No products match your search"
                  : "No products available"}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProductToCart(product)}
                    disabled={product.isService === true}
                    className="group relative overflow-hidden rounded-md border bg-white text-left shadow-sm transition hover:border-[#714b67] hover:shadow-md active:scale-[0.98] disabled:opacity-40"
                  >
                    <span className="absolute right-0 top-0 z-10 flex h-5 w-5 items-center justify-center bg-slate-300 text-[10px] font-bold text-white">
                      i
                    </span>
                    <div className="aspect-[4/3] bg-muted">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-slate-100">
                          <ShoppingCart className="h-8 w-8 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 p-2">
                      <p className="line-clamp-2 min-h-[34px] text-sm font-semibold leading-tight">
                        {product.name}
                      </p>
                      <p className="text-sm font-bold text-[#714b67]">
                        {formatCurrency(Number(product.sellingPrice) || 0)}
                      </p>
                      {Number(product.stock) <= 0 && (
                        <p className="text-xs text-red-600">Out of stock</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {isFullscreen && fullscreenPrintSaleId && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="flex h-[min(720px,calc(100vh-2rem))] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex h-12 items-center gap-2 border-b px-3">
              <Printer className="h-4 w-4 text-[#714b67]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">Receipt ready</p>
                <p className="truncate text-xs text-muted-foreground">
                  Print thermal invoice
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={printFullscreenReceipt}
              >
                <Printer className="mr-2 h-4 w-4" />
                Exit fullscreen & print
              </Button>
              <button
                type="button"
                onClick={() => {
                  setFullscreenPrintSaleId(null);
                  requestAnimationFrame(() => barcodeRef.current?.focus());
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close receipt popup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe
              ref={receiptFrameRef}
              src={thermalInvoicePrintUrl(fullscreenPrintSaleId, {
                autoPrint: false,
              })}
              title="Thermal invoice receipt"
              className="min-h-0 flex-1 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof ShoppingCart;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 cursor-pointer items-center justify-center gap-2 border-b border-r transition ${
        active
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function ModeButton({
  active,
  label,
  onClick,
  icon: Icon,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon?: typeof ShoppingCart;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 flex-1 cursor-pointer items-center justify-center gap-1 rounded border text-xs font-semibold transition disabled:opacity-30 sm:h-10 sm:text-sm ${
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-transparent hover:bg-muted"
      }`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </button>
  );
}

function CategoryButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}
