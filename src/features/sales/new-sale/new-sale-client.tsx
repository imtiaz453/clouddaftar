"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/providers/toast-provider";
import {
  Search,
  Plus,
  Trash2,
  Barcode,
  Loader2,
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
  calculateLineTotal,
} from "@/components/shared/line-item-editor";
import {
  openThermalInvoicePrintWindow,
  printThermalInvoiceViaBridge,
  printThermalInvoice,
  thermalInvoicePrintUrl,
} from "@/features/sales/print-utils";

interface NewSaleClientProps {
  products: ProductOption[];
  customers: { id: string; name: string }[];
  categories?: { id: string; name: string; color?: string | null }[];
  defaultTaxRate?: number;
  taxComplianceMode?: string;
}

function createEmptyRow(): LineItem {
  return {
    id: Math.random().toString(36).substring(2, 10),
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
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [buyerTaxNumber, setBuyerTaxNumber] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [padMode, setPadMode] = useState<"qty" | "discount" | "price">("qty");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenPrintSaleId, setFullscreenPrintSaleId] = useState<string | null>(null);
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null);
  const posShellRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const receiptFrameRef = useRef<HTMLIFrameElement>(null);
  const autoPaid = useRef(true);

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

  const totals = calculateTotals(items, globalDiscount);

  useEffect(() => {
    if (autoPaid.current) setPaid(String(totals.grandTotal));
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

  function addProductToCart(product: ProductOption) {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id && item.productId);
      if (existing) {
        setSelectedItemId(existing.id);
        return prev.map((item) =>
          item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      const taxRate = product.tax != null ? Number(product.tax) : defaultTaxRate || 0;
      const id = Math.random().toString(36).substring(2, 10);
      setSelectedItemId(id);
      return [
        ...prev,
        {
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
        },
      ];
    });
  }

  function patchSelectedItem(patch: Partial<LineItem>) {
    if (!selectedItemId) return;
    setItems((prev) =>
      prev.map((item) => (item.id === selectedItemId ? { ...item, ...patch } : item)),
    );
  }

  function handleKeypad(value: string) {
    const selected = items.find((item) => item.id === selectedItemId);
    if (!selected) return;
    if (value === "back") {
      if (padMode === "qty") {
        const next = Math.floor(selected.quantity / 10);
        if (next <= 0) removeCartItem(selected.id);
        else patchSelectedItem({ quantity: next });
        return;
      }
      const key = padMode === "discount" ? "discount" : "price";
      const next = String(selected[key] || "").slice(0, -1);
      patchSelectedItem({ [key]: Number(next) || 0 } as Partial<LineItem>);
      return;
    }
    if (value === "+/-") return;
    if (padMode === "qty") {
      const current = selected.quantity === 1 ? "" : String(selected.quantity);
      patchSelectedItem({ quantity: Math.max(1, Number(`${current}${value}`) || 1) });
      return;
    }
    const key = padMode === "discount" ? "discount" : "price";
    const current = String(selected[key] || "");
    const next = value === "." && current.includes(".") ? current : `${current}${value}`;
    patchSelectedItem({ [key]: Number(next) || 0 } as Partial<LineItem>);
  }

  function removeCartItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
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

  async function handleSubmit(status: string) {
    if (validItems.length === 0) {
      addToast({ title: "Add at least one product", variant: "error" });
      return;
    }

    const keepFullscreen = document.fullscreenElement === posShellRef.current;
    const printWindow =
      status === "DRAFT" || keepFullscreen ? null : openThermalInvoicePrintWindow();
    setLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          items: validItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            tax: item.tax,
          })),
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

      const successMessage =
        status === "DRAFT" ? "Draft saved" : `Sale completed: Invoice ${data.data?.invoiceNumber}`;
      if (keepFullscreen) {
        setFullscreenNotice(successMessage);
      } else {
        addToast({
          title: status === "DRAFT" ? "Draft saved" : "Sale completed",
          description: `Invoice ${data.data?.invoiceNumber}`,
          variant: "success",
        });
      }

      setItems([]);
      setCustomerId("");
      setPaid("");
      setDueDate("");
      autoPaid.current = true;
      setNotes("");
      setTerms("");
      setGlobalDiscount(0);
      setSearchQuery("");
      setActiveCategory(null);
      setBuyerTaxNumber("");

      if (status !== "DRAFT" && saleId && keepFullscreen) {
        const bridgeResult = await printThermalInvoiceViaBridge(saleId);
        if (bridgeResult.ok) {
          setFullscreenNotice(`Invoice ${data.data?.invoiceNumber} sent to thermal printer`);
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
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const selectedItem = items.find((item) => item.id === selectedItemId) || null;
  const categoryName =
    activeCategory === null
      ? "All Products"
      : uniqueCategories.find((category) => category.id === activeCategory)?.name || "Products";
  const keypadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "+/-", "0", ".", "back"];

  return (
    <div
      ref={posShellRef}
      className={`relative overflow-hidden border bg-slate-100 shadow-sm ${
        isFullscreen ? "h-screen rounded-none" : "h-[calc(100vh-4rem)] rounded-xl"
      }`}
    >
      {isFullscreen && fullscreenNotice && (
        <div className="absolute left-1/2 top-4 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-xl">
          <Check className="h-4 w-4" />
          {fullscreenNotice}
        </div>
      )}
      <div className="flex h-16 items-center gap-4 border-b bg-white/95 px-4">
        <div className="min-w-0">
          <div className="text-lg font-semibold tracking-tight text-foreground">Point of Sale</div>
          <div className="text-xs text-muted-foreground">
            Invoice checkout, customer, tax, notes, and terms
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <span className="rounded-lg border bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
            Lines {validItems.length}
          </span>
          <span className="rounded-lg border bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
            {taxLabel()} {formatCurrency(totals.totalTax)}
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
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <Menu className="h-5 w-5" />
        </div>
      </div>

      <div className="grid h-[calc(100%-4rem)] grid-cols-1 overflow-hidden lg:grid-cols-[42%_58%]">
        <section className="flex min-h-0 flex-col border-r bg-white">
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
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    role="button"
                    tabIndex={0}
                    className={`grid w-full grid-cols-[1fr_auto] gap-3 px-4 py-3 text-left transition ${
                      selectedItemId === item.id
                        ? "bg-primary/10"
                        : "cursor-pointer hover:bg-muted/60"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {item.productName}
                      </span>
                      <span className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                        <label className="space-y-1">
                          <span className="block">Qty</span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={Number.isFinite(item.quantity) ? item.quantity : 1}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((row) =>
                                  row.id === item.id
                                    ? {
                                        ...row,
                                        quantity: Math.max(
                                          1,
                                          Number.parseInt(e.target.value, 10) || 1,
                                        ),
                                      }
                                    : row,
                                ),
                              )
                            }
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm text-foreground"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block">Unit Price</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={Number.isFinite(item.price) ? item.price : 0}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((row) =>
                                  row.id === item.id
                                    ? {
                                        ...row,
                                        price: Math.max(0, Number.parseFloat(e.target.value) || 0),
                                      }
                                    : row,
                                ),
                              )
                            }
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm text-foreground"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block">Discount</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={Number.isFinite(item.discount) ? item.discount : 0}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((row) =>
                                  row.id === item.id
                                    ? {
                                        ...row,
                                        discount: Math.max(
                                          0,
                                          Number.parseFloat(e.target.value) || 0,
                                        ),
                                      }
                                    : row,
                                ),
                              )
                            }
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm text-foreground"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block">{taxLabel()} %</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={Number.isFinite(item.tax) ? item.tax : 0}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((row) =>
                                  row.id === item.id
                                    ? {
                                        ...row,
                                        tax: Math.max(0, Number.parseFloat(e.target.value) || 0),
                                      }
                                    : row,
                                ),
                              )
                            }
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm text-foreground"
                          />
                        </label>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.unit || "Units"} x {formatCurrency(item.price)}
                      </span>
                    </span>
                    <span className="flex items-start gap-2">
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(calculateLineTotal(item))}
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
                ))}
              </div>
            )}
          </div>

          <div className="border-t bg-[#f5f6f7]">
            <div className="px-4 py-3 text-right">
              <p className="text-xs text-muted-foreground">
                {taxLabel()}: {formatCurrency(totals.totalTax)}
              </p>
              <p className="text-2xl font-bold">Total: {formatCurrency(totals.grandTotal)}</p>
            </div>
            <div className="grid grid-cols-3 border-y bg-white text-xs font-medium text-muted-foreground">
              <ToolbarButton icon={RotateCcw} label="Refund" />
              <ToolbarButton icon={FileText} label="Order Note" />
              <ToolbarButton icon={Barcode} label="Barcode" />
              <ToolbarButton icon={Star} label="Loyalty" />
              <ToolbarButton icon={FilePlus2} label="Sales Order" />
              <ToolbarButton icon={CreditCard} label={paymentMethod.replace("_", " ")} />
            </div>

            <div className="grid grid-cols-[35%_65%]">
              <div className="flex flex-col">
                <Select value={customerId} onValueChange={handleCustomerChange}>
                  <SelectTrigger className="h-12 rounded-none border-0 border-b bg-white text-sm">
                    <SelectValue placeholder="Walk-in Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__create_customer__">Create new customer</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => handleSubmit("COMPLETED")}
                  disabled={loading || validItems.length === 0}
                  className="flex min-h-[146px] flex-1 items-center justify-center bg-[#7c4d72] px-3 text-lg font-bold text-white transition hover:bg-[#6d4364] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Payment
                </button>
              </div>

              <div className="grid grid-cols-4 bg-white">
                {keypadKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypad(key)}
                    disabled={!selectedItem}
                    className="flex h-12 items-center justify-center border-b border-l text-base font-semibold hover:bg-[#e7f2f2] disabled:opacity-40"
                  >
                    {key === "back" ? <Delete className="h-4 w-4" /> : key}
                  </button>
                ))}
                <ModeButton
                  active={padMode === "qty"}
                  label="Qty"
                  onClick={() => setPadMode("qty")}
                />
                <ModeButton
                  active={padMode === "discount"}
                  label="% Disc"
                  onClick={() => setPadMode("discount")}
                  icon={Percent}
                />
                <ModeButton
                  active={padMode === "price"}
                  label="Price"
                  onClick={() => setPadMode("price")}
                />
              </div>
            </div>

            <div className="grid gap-2 border-t bg-white p-3 sm:grid-cols-5">
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="MOBILE_PAYMENT">Mobile Payment</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="number"
                step="0.01"
                value={paid}
                onChange={(e) => {
                  autoPaid.current = false;
                  setPaid(e.target.value);
                }}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                placeholder="Paid"
              />
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={invoiceFullyPaid}
                  data-empty={!dueDate ? "true" : undefined}
                  className={`date-input h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-70 ${
                    !dueDate ? "date-input-empty" : ""
                  }`}
                  title={invoiceFullyPaid ? "Paid in full, no due date needed" : "Due date"}
                />
                {!dueDate && (
                  <span className="date-input-placeholder pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {invoiceFullyPaid ? "Paid in full" : "Due date"}
                  </span>
                )}
              </div>
              <input
                type="number"
                min={0}
                value={globalDiscount}
                onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                placeholder="Discount"
              />
              <Button
                variant="outline"
                onClick={() => handleSubmit("DRAFT")}
                disabled={loading || validItems.length === 0}
              >
                <Save className="mr-2 h-4 w-4" />
                Draft
              </Button>
              {taxComplianceMode !== "NONE" && (
                <input
                  type="text"
                  placeholder={`Buyer ${taxComplianceMode === "ZATCA" ? "VAT No." : "NTN"}`}
                  value={buyerTaxNumber}
                  onChange={(e) => setBuyerTaxNumber(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm sm:col-span-2"
                />
              )}
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm sm:col-span-2"
                placeholder="Notes"
              />
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
                className="min-h-20 rounded-md border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary sm:col-span-2"
                placeholder="Terms & Conditions"
              />
              {(balanceDue > 0 || change > 0) && (
                <div className="flex items-center justify-end text-sm font-semibold sm:col-span-2">
                  {balanceDue > 0 ? (
                    <span className="text-red-600">Balance {formatCurrency(balanceDue)}</span>
                  ) : (
                    <span className="text-emerald-600">Change {formatCurrency(change)}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col bg-[#d8dbde]">
          <div className="flex flex-wrap items-center gap-2 border-b bg-white px-3 py-2">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Home className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground">›</span>
            <span className="min-w-0 truncate text-sm font-semibold">{categoryName}</span>
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

          <div className="flex gap-1 overflow-x-auto border-b bg-white px-3 py-2">
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
                {searchQuery ? "No products match your search" : "No products available"}
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
                <p className="truncate text-xs text-muted-foreground">Print thermal invoice</p>
              </div>
              <Button type="button" size="sm" onClick={printFullscreenReceipt}>
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
              src={thermalInvoicePrintUrl(fullscreenPrintSaleId, { autoPrint: false })}
              title="Thermal invoice receipt"
              className="min-h-0 flex-1 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ icon: Icon, label }: { icon: typeof ShoppingCart; label: string }) {
  return (
    <button
      type="button"
      className="flex h-9 cursor-pointer items-center justify-center gap-2 border-b border-r hover:bg-muted"
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
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon?: typeof ShoppingCart;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 cursor-pointer items-center justify-center gap-1 border-b border-l text-sm font-semibold ${
        active ? "bg-primary/10 text-primary" : "hover:bg-muted"
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
