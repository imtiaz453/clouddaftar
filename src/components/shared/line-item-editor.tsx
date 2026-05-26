"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Plus, Trash2, Copy, Barcode, Search, GripVertical, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dashboardHref } from "@/lib/dashboard-href";
import { formatCurrency, taxLabel } from "@/lib/utils";

export interface LineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  unit: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  stock: number;
}

export interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sellingPrice: number | string | null;
  purchasePrice?: number | string | null;
  tax?: number | string | null;
  unit: string | null;
  stock: number;
  image?: string | null;
  categoryId?: string | null;
  isActive?: boolean;
  isService?: boolean;
}

export interface LineItemTotals {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  itemCount: number;
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function createEmptyRow(): LineItem {
  return {
    id: generateId(),
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

function normalizeBarcode(value: string): string {
  return value.trim();
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function selectedTaxRate(product: ProductOption, defaultTaxRate: number): number {
  if (product.tax != null) {
    const productTax = Number(product.tax);
    if (Number.isFinite(productTax) && productTax > 0) return productTax;
  }
  return toNumber(defaultTaxRate, 0);
}

export function getProductLineDefaults(
  product: ProductOption,
  defaultTaxRate = 0,
): Omit<LineItem, "id"> {
  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku || "",
    barcode: product.barcode || "",
    unit: product.unit || "",
    quantity: 1,
    price: toNumber(product.sellingPrice, 0),
    discount: 0,
    tax: selectedTaxRate(product, defaultTaxRate),
    stock: toNumber(product.stock, 0),
  };
}

export function applyScannedBarcode(
  currentItems: LineItem[],
  products: ProductOption[],
  rawBarcode: string,
  defaultTaxRate = 0,
): { found: boolean; items: LineItem[] } {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) return { found: false, items: currentItems };

  const product = products.find(
    (p) =>
      p.barcode?.trim().toLowerCase() === barcode.toLowerCase() &&
      p.isActive !== false &&
      p.isService !== true,
  );

  if (!product) return { found: false, items: currentItems };

  const existing = currentItems.find(
    (item) => item.productId && item.barcode.trim().toLowerCase() === barcode.toLowerCase(),
  );

  if (existing) {
    return {
      found: true,
      items: currentItems.map((item) =>
        item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    };
  }

  const filled = {
    ...createEmptyRow(),
    ...getProductLineDefaults(product, defaultTaxRate),
  };
  const emptyIdx = currentItems.findIndex((item) => !item.productId);
  if (emptyIdx >= 0) {
    const nextItems = [...currentItems];
    nextItems[emptyIdx] = filled;
    return { found: true, items: nextItems };
  }

  return { found: true, items: [...currentItems, filled] };
}

export function calculateLineTotal(item: LineItem): number {
  const lineTotal = item.price * item.quantity;
  const lineDiscount = item.discount;
  const taxableAmount = lineTotal - lineDiscount;
  const lineTax = taxableAmount * (item.tax / 100);
  return taxableAmount + lineTax;
}

export function calculateTotals(items: LineItem[], globalDiscount = 0): LineItemTotals {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalItemDiscount = items.reduce((s, i) => s + i.discount, 0);
  const totalDiscount = globalDiscount + totalItemDiscount;
  const totalTax = items.reduce((s, i) => {
    const lineTotal = i.price * i.quantity - i.discount;
    return s + lineTotal * (i.tax / 100);
  }, 0);
  const grandTotal = subtotal - totalDiscount + totalTax;
  return { subtotal, totalDiscount, totalTax, grandTotal, itemCount: items.length };
}

interface LineItemEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  products: ProductOption[];
  readOnly?: boolean;
  showBarcode?: boolean;
  showStock?: boolean;
  barcodeInput?: string;
  onBarcodeChange?: (value: string) => void;
  barcodeRef?: React.RefObject<HTMLInputElement | null>;
  defaultTaxRate?: number;
}

export function LineItemEditor({
  items,
  onChange,
  products,
  readOnly = false,
  showBarcode = true,
  showStock = true,
  barcodeInput,
  onBarcodeChange,
  barcodeRef,
  defaultTaxRate = 0,
}: LineItemEditorProps) {
  const pathname = usePathname();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
    position: "absolute" | "fixed";
  } | null>(null);
  const [dropdownPortalTarget, setDropdownPortalTarget] = useState<HTMLElement | null>(null);
  const searchInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lastRowRef = useRef<HTMLDivElement | null>(null);
  const mobilePosRef = useRef<{ top: number; left: number; width: number } | null>(null);

  const updateDropdownPosition = useCallback((itemId: string) => {
    if (typeof document === "undefined") return;

    const el = searchInputRefs.current[itemId];
    if (!el) return;

    const inputRect = el.getBoundingClientRect();
    const dialog = el.closest('[role="dialog"]') as HTMLElement | null;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const fallbackWidth = Math.max(inputRect.width, 320);

    if (dialog) {
      const dialogRect = dialog.getBoundingClientRect();
      const maxDialogWidth = Math.max(240, dialogRect.width - 16);
      const width = Math.min(fallbackWidth, maxDialogWidth);
      const left = Math.max(
        8,
        Math.min(inputRect.left - dialogRect.left + dialog.scrollLeft, maxDialogWidth - width + 8),
      );
      setDropdownPortalTarget(dialog);
      setDropdownRect({
        top: inputRect.bottom - dialogRect.top + dialog.scrollTop + 4,
        left,
        width,
        position: "absolute",
      });
      return;
    }

    setDropdownPortalTarget(document.body);
    const width = Math.min(fallbackWidth, Math.max(240, viewportWidth - 16));
    const left = Math.max(8, Math.min(inputRect.left, viewportWidth - width - 8));
    setDropdownRect({
      top: inputRect.bottom + 4,
      left,
      width,
      position: "fixed",
    });
  }, []);

  const addRow = useCallback(() => {
    const newRow = createEmptyRow();
    onChange([...items, newRow]);
    setFocusId(newRow.id);
    setOpenDropdownId(newRow.id);
  }, [items, onChange]);

  const removeRow = useCallback(
    (id: string) => {
      if (items.length <= 1) return;
      onChange(items.filter((i) => i.id !== id));
    },
    [items, onChange],
  );

  const duplicateRow = useCallback(
    (id: string) => {
      const source = items.find((i) => i.id === id);
      if (!source) return;
      const newRow = { ...source, id: generateId() };
      const idx = items.findIndex((i) => i.id === id);
      const newItems = [...items];
      newItems.splice(idx + 1, 0, newRow);
      onChange(newItems);
      setFocusId(newRow.id);
    },
    [items, onChange],
  );

  const updateRow = useCallback(
    (id: string, field: keyof LineItem, value: any) => {
      onChange(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    },
    [items, onChange],
  );

  const selectProduct = useCallback(
    (itemId: string, product: ProductOption) => {
      onChange(
        items.map((i) =>
          i.id === itemId
            ? {
                ...i,
                ...getProductLineDefaults(product, defaultTaxRate),
                quantity: Math.max(1, toNumber(i.quantity, 1)),
              }
            : i,
        ),
      );

      // close dropdown properly
      setOpenDropdownId(null);
      setDropdownRect(null);
      setDropdownPortalTarget(null);
      mobilePosRef.current = null;

      // clear temporary search text
      setSearchTerms((prev) => ({
        ...prev,
        [itemId]: "",
      }));

      // restore focus stability
      requestAnimationFrame(() => {
        const input = searchInputRefs.current[itemId];
        input?.blur();
      });
    },
    [items, onChange, defaultTaxRate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, itemId: string, isLast: boolean) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isLast) {
          addRow();
        }
      }
      if (e.key === "Tab" && !e.shiftKey && isLast) {
        const row = items[items.length - 1];
        if (row.productId) {
          setTimeout(() => addRow(), 0);
        }
      }
    },
    [addRow, items],
  );

  const filteredProducts = useCallback(
    (search: string) => {
      if (!search) return [];
      const q = search.toLowerCase();
      return products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)),
      );
    },
    [products],
  );

  useEffect(() => {
    if (focusId) {
      const input = searchInputRefs.current[focusId];
      if (input) {
        input.focus();
        input.select();
      }
      setFocusId(null);
    }
  }, [focusId, items.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-product-search]") || target.closest("[data-product-dropdown]")) {
        return;
      }
      setOpenDropdownId(null);
      setDropdownRect(null);
      setDropdownPortalTarget(null);
      mobilePosRef.current = null;
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!openDropdownId) return;

    const update = () => updateDropdownPosition(openDropdownId);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [openDropdownId, updateDropdownPosition]);

  const activeSearch = openDropdownId ? searchTerms[openDropdownId] || "" : "";
  const activeResults = openDropdownId ? filteredProducts(activeSearch) : [];

  return (
    <div className="space-y-2">
      {showBarcode && (
        <div className="relative mb-3 w-full max-w-xs">
          <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={barcodeRef as React.RefObject<HTMLInputElement>}
            type="text"
            placeholder="Scan barcode... (auto-adds item)"
            value={barcodeInput || ""}
            onChange={(e) => onBarcodeChange?.(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm"
          />
        </div>
      )}

      {/* Mobile card view */}
      <div className="block sm:hidden space-y-3">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No items added yet
          </div>
        ) : (
          items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            const showDropdown = openDropdownId === item.id;
            const searchTerm = searchTerms[item.id] || "";
            return (
              <div
                key={item.id}
                className={`rounded-lg border p-3 space-y-2 ${!item.productId ? "bg-muted/20" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                  {!readOnly && (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => duplicateRow(item.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Duplicate"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(item.id)}
                        disabled={items.length <= 1}
                        className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Product search */}
                {readOnly ? (
                  <span className="text-sm font-medium">{item.productName || "-"}</span>
                ) : (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      data-product-search="true"
                      ref={(el) => { searchInputRefs.current[item.id] = el; }}
                      type="text"
                      placeholder="Search or scan product..."
                      value={item.productId ? item.productName : searchTerm}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (item.productId) {
                          onChange(items.map((i) =>
                            i.id === item.id ? { ...i, productId: "", productName: "", sku: "", barcode: "", unit: "", price: 0, tax: 0, stock: 0, discount: 0 } : i
                          ));
                        }
                        setSearchTerms((prev) => ({ ...prev, [item.id]: val }));
                        setOpenDropdownId(item.id);
                        const el = searchInputRefs.current[item.id];
                        if (el) {
                          const r = el.getBoundingClientRect();
                          mobilePosRef.current = { top: r.bottom + 4, left: r.left, width: Math.max(r.width, 300) };
                        }
                      }}
                      onFocus={() => {
                        if (!item.productId) {
                          setOpenDropdownId(item.id);
                          const el = searchInputRefs.current[item.id];
                          if (el) {
                            const r = el.getBoundingClientRect();
                            mobilePosRef.current = { top: r.bottom + 4, left: r.left, width: Math.max(r.width, 300) };
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && showDropdown && activeResults.length > 0 && !item.productId) {
                          e.preventDefault();
                          selectProduct(item.id, activeResults[0]);
                          return;
                        }
                        handleKeyDown(e, item.id, isLast);
                      }}
                      className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    {showDropdown && mobilePosRef.current && typeof document !== "undefined" && createPortal(
                      <div
                        data-product-dropdown="true"
                        className="z-[9999] max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg"
                        style={{
                          position: "fixed",
                          top: mobilePosRef.current.top,
                          left: mobilePosRef.current.left,
                          width: mobilePosRef.current.width,
                        }}
                      >
                        {activeResults.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                            <p>{searchTerm ? "No products found" : "Type to search..."}</p>
                            {searchTerm && (
                              <a href={dashboardHref(pathname, "/inventory", { createProduct: searchTerm })}
                                className="mt-3 inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-accent">
                                <Plus className="h-3.5 w-3.5" /> Create product
                              </a>
                            )}
                          </div>
                        ) : (
                          activeResults.slice(0, 30).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => selectProduct(item.id, p)}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                            >
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border bg-muted">
                                {p.image ? (
                                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-muted-foreground/30">
                                    <ShoppingCart className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{p.name}</div>
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                  {p.sku && <span>SKU: {p.sku}</span>}
                                  {p.barcode && <span>Code: {p.barcode}</span>}
                                  {p.unit && <span>{p.unit}</span>}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="font-medium">{formatCurrency(toNumber(p.sellingPrice, 0))}</div>
                                {showStock && (
                                  <div className={`text-xs ${p.stock <= 0 ? "text-red-500" : "text-muted-foreground"}`}>
                                    Stock: {p.stock}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>,
                      document.body,
                    )}
                  </div>
                )}

                {/* Info row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>SKU: {item.sku || "-"}</span>
                  {showStock && (
                    <span className={item.stock <= 0 && item.productId ? "text-red-500" : ""}>
                      Stock: {item.productId ? item.stock : "-"}
                    </span>
                  )}
                  {item.unit && <span>Unit: {item.unit}</span>}
                </div>

                {/* Input fields grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-xs text-muted-foreground">Qty</label>
                    {readOnly ? (
                      <span className="block text-sm">{item.quantity}</span>
                    ) : (
                      <input
                        type="number" min={0} step={1}
                        value={Number.isFinite(item.quantity) ? item.quantity : 1}
                        onChange={(e) => updateRow(item.id, "quantity", Math.max(0, parseInt(e.target.value) || 0))}
                        onKeyDown={(e) => handleKeyDown(e, item.id, isLast)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs text-muted-foreground">Unit Price</label>
                    {readOnly ? (
                      <span className="block text-sm">{formatCurrency(item.price)}</span>
                    ) : (
                      <input
                        type="number" min={0} step={0.01}
                        value={Number.isFinite(item.price) ? item.price : 0}
                        onChange={(e) => updateRow(item.id, "price", Math.max(0, parseFloat(e.target.value) || 0))}
                        onKeyDown={(e) => handleKeyDown(e, item.id, isLast)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs text-muted-foreground">Disc</label>
                    {readOnly ? (
                      <span className="block text-sm">{formatCurrency(item.discount)}</span>
                    ) : (
                      <input
                        type="number" min={0} step={0.01}
                        value={Number.isFinite(item.discount) ? item.discount : 0}
                        onChange={(e) => updateRow(item.id, "discount", Math.max(0, parseFloat(e.target.value) || 0))}
                        onKeyDown={(e) => handleKeyDown(e, item.id, isLast)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs text-muted-foreground">{taxLabel()} %</label>
                    {readOnly ? (
                      <span className="block text-sm">{item.tax}%</span>
                    ) : (
                      <input
                        type="number" min={0} max={100} step={0.01}
                        value={Number.isFinite(item.tax) ? item.tax : 0}
                        onChange={(e) => updateRow(item.id, "tax", Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                        onKeyDown={(e) => handleKeyDown(e, item.id, isLast)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-between border-t pt-2 text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(calculateLineTotal(item))}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-8 px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                #
              </th>
              <th className="min-w-[200px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                Product
              </th>
              <th className="w-24 px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                SKU
              </th>
              {showStock && (
                <th className="w-16 px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                  Stock
                </th>
              )}
              <th className="w-20 px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                Qty
              </th>
              <th className="w-24 px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                Unit Price
              </th>
              <th className="w-20 px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                Disc
              </th>
              <th className="w-20 px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                {taxLabel()} %
              </th>
              <th className="w-28 px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                Subtotal
              </th>
              <th className="w-20 px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isLast = idx === items.length - 1;
              const showDropdown = openDropdownId === item.id;
              const searchTerm = searchTerms[item.id] || "";

              return (
                <tr
                  key={item.id}
                  className={`border-b transition-colors last:border-0 ${!item.productId ? "bg-muted/20" : ""}`}
                >
                  <td className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                    {idx + 1}
                  </td>
                  <td className="relative px-2 py-1.5">
                    {readOnly ? (
                      <span className="text-sm">{item.productName || "-"}</span>
                    ) : (
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          data-product-search="true"
                          ref={(el) => {
                            searchInputRefs.current[item.id] = el;
                          }}
                          type="text"
                          placeholder="Search or scan product..."
                          value={item.productId ? item.productName : searchTerm}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (item.productId) {
                              onChange(
                                items.map((i) =>
                                  i.id === item.id
                                    ? {
                                        ...i,
                                        productId: "",
                                        productName: "",
                                        sku: "",
                                        barcode: "",
                                        unit: "",
                                        price: 0,
                                        tax: 0,
                                        stock: 0,
                                        discount: 0,
                                      }
                                    : i,
                                ),
                              );
                            }
                            setSearchTerms((prev) => ({ ...prev, [item.id]: val }));
                            setOpenDropdownId(item.id);
                            updateDropdownPosition(item.id);
                          }}
                          onFocus={() => {
                            if (!item.productId) {
                              setOpenDropdownId(item.id);
                              updateDropdownPosition(item.id);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              showDropdown &&
                              activeResults.length > 0 &&
                              !item.productId
                            ) {
                              e.preventDefault();
                              selectProduct(item.id, activeResults[0]);
                              return;
                            }
                            handleKeyDown(e, item.id, isLast);
                          }}
                          className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                        {showDropdown &&
                          dropdownRect &&
                          dropdownPortalTarget &&
                          typeof document !== "undefined" &&
                          createPortal(
                            <div
                              data-product-dropdown="true"
                              className="z-[9999] mt-0 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg"
                              style={{
                                position: dropdownRect.position,
                                top: dropdownRect.top,
                                left: dropdownRect.left,
                                width: dropdownRect.width,
                                pointerEvents: "auto",
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onWheel={(e) => e.stopPropagation()}
                            >
                              {activeResults.length === 0 ? (
                                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                  <p>{searchTerm ? "No products found" : "Type to search..."}</p>
                                  {searchTerm && (
                                    <a
                                      href={dashboardHref(pathname, "/inventory", {
                                        createProduct: searchTerm,
                                      })}
                                      className="mt-3 inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-accent"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Create product
                                    </a>
                                  )}
                                </div>
                              ) : (
                                activeResults.slice(0, 30).map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    data-product-dropdown="true"
                                    onPointerDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      selectProduct(item.id, p);
                                    }}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    onClick={(e) => {
                                      if (e.detail === 0) {
                                        selectProduct(item.id, p);
                                      }
                                    }}
                                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                                  >
                                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border bg-muted">
                                      {p.image ? (
                                        <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full items-center justify-center text-muted-foreground/30">
                                          <ShoppingCart className="h-4 w-4" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate font-medium">{p.name}</div>
                                      <div className="flex gap-2 text-xs text-muted-foreground">
                                        {p.sku && <span>SKU: {p.sku}</span>}
                                        {p.barcode && <span>Code: {p.barcode}</span>}
                                        {p.unit && <span>{p.unit}</span>}
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <div className="font-medium">
                                        {formatCurrency(toNumber(p.sellingPrice, 0))}
                                      </div>
                                      {showStock && (
                                        <div
                                          className={`text-xs ${p.stock <= 0 ? "text-red-500" : "text-muted-foreground"}`}
                                        >
                                          Stock: {p.stock}
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>,
                            dropdownPortalTarget,
                          )}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="text-xs text-muted-foreground">{item.sku || "-"}</span>
                  </td>
                  {showStock && (
                    <td className="px-2 py-1.5 text-right">
                      <span
                        className={`text-xs ${item.stock <= 0 && item.productId ? "text-red-500" : "text-muted-foreground"}`}
                      >
                        {item.productId ? item.stock : "-"}
                      </span>
                    </td>
                  )}
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span className="block text-right text-sm">{item.quantity}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={Number.isFinite(item.quantity) ? item.quantity : 1}
                        onChange={(e) =>
                          updateRow(item.id, "quantity", Math.max(0, parseInt(e.target.value) || 0))
                        }
                        onKeyDown={(e) => handleKeyDown(e, item.id, isLast)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span className="block text-right text-sm">{formatCurrency(item.price)}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={Number.isFinite(item.price) ? item.price : 0}
                        onChange={(e) =>
                          updateRow(item.id, "price", Math.max(0, parseFloat(e.target.value) || 0))
                        }
                        onKeyDown={(e) => handleKeyDown(e, item.id, isLast)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span className="block text-right text-sm">
                        {formatCurrency(item.discount)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={Number.isFinite(item.discount) ? item.discount : 0}
                        onChange={(e) =>
                          updateRow(
                            item.id,
                            "discount",
                            Math.max(0, parseFloat(e.target.value) || 0),
                          )
                        }
                        onKeyDown={(e) => handleKeyDown(e, item.id, isLast)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span className="block text-right text-sm">{item.tax}%</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={Number.isFinite(item.tax) ? item.tax : 0}
                        onChange={(e) =>
                          updateRow(
                            item.id,
                            "tax",
                            Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                          )
                        }
                        onKeyDown={(e) => handleKeyDown(e, item.id, isLast)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span className="text-sm font-medium">
                      {formatCurrency(calculateLineTotal(item))}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    {!readOnly && (
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => duplicateRow(item.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Duplicate"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(item.id)}
                          disabled={items.length <= 1}
                          className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Add Line
        </Button>
      )}
    </div>
  );
}
