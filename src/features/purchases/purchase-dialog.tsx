"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/providers/toast-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product, Supplier } from "@prisma/client";
import { Plus, Minus, Trash2, Search, Save, Check, Printer } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCurrency, taxLabel } from "@/lib/utils";
import { dashboardHref } from "@/lib/dashboard-href";
import {
  DocumentFormHeader,
  DocumentFormSection,
  DocumentMetric,
  DocumentSummaryPanel,
  documentTextareaClassName,
} from "@/components/shared/document-form-layout";

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  suppliers: Supplier[];
  purchase?: any;
}

interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  discount: number;
  tax: number;
  description?: string;
}

function dateInputValue(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function PurchaseDialog({
  open,
  onOpenChange,
  products,
  suppliers,
  purchase,
}: PurchaseDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paid, setPaid] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const isEditing = !!purchase;

  useEffect(() => {
    if (open) {
      if (purchase) {
        setCart(
          (purchase.items || []).map((item: any) => ({
            productId: item.productId,
            productName: item.product?.name || "Unknown",
            price: Number(item.price),
            quantity: item.quantity,
            discount: Number(item.discount),
            tax: Number(item.tax),
            description: item.description || "",
          })),
        );
        setSupplierId(purchase.supplierId || "");
        setPaymentMethod(purchase.paymentMethod || "CASH");
        setPaid(String(Number(purchase.paid)));
        setDueDate(dateInputValue(purchase.dueDate));
        setNotes(purchase.notes || "");
        setTerms(purchase.terms || "");
      } else {
        setCart([]);
        setSupplierId("");
        setPaymentMethod("CASH");
        setPaid("");
        setDueDate("");
        setNotes("");
        setTerms("");
      }
      setProductSearch("");
    }
  }, [open, purchase]);

  const filteredProducts = products.filter(
    (p) =>
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))) &&
      p.isActive,
  );

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing)
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          price: Number(product.purchasePrice),
          quantity: 1,
          discount: 0,
          tax: 0,
          description: "",
        },
      ];
    });
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const totalTax = cart.reduce((sum, item) => {
    const taxable = Math.max(0, item.price * item.quantity - item.discount);
    return sum + (taxable * (item.tax || 0)) / 100;
  }, 0);
  const total = subtotal - totalDiscount + totalTax;
  const amountPaid = Math.max(0, parseFloat(paid) || 0);
  const balanceDue = Math.max(0, total - amountPaid);

  function handleSupplierChange(value: string) {
    if (value === "__create_supplier__") {
      window.location.assign(dashboardHref(pathname, "/suppliers"));
      return;
    }
    setSupplierId(value);
  }

  async function handleSubmit(status: string) {
    if (cart.length === 0) {
      addToast({ title: "Cart is empty", variant: "error" });
      return;
    }
    setLoading(true);
    try {
      const url = purchase ? `/api/purchases/${purchase.id}` : "/api/purchases";
      const method = purchase ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId || undefined,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            tax: item.tax,
            description: item.description || undefined,
          })),
          discount: 0,
          paymentMethod,
          notes: notes || undefined,
          terms: terms || undefined,
          paid: amountPaid,
          dueDate: dueDate || null,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast({
        title: status === "DRAFT" ? "Draft saved" : "Purchase recorded",
        variant: "success",
      });
      setCart([]);
      setSupplierId("");
      setPaid("");
      setDueDate("");
      setNotes("");
      setTerms("");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[min(1180px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {isEditing ? "Edit Purchase Order" : "New Purchase Order"}
          </DialogTitle>
          <DocumentFormHeader
            title={isEditing ? "Edit Purchase Order" : "New Purchase Order"}
            subtitle="Capture supplier, receipt timing, cost, tax, payment, and supplier-facing terms."
          >
            <DocumentMetric label="Lines" value={cart.length} />
            <DocumentMetric label={taxLabel()} value={formatCurrency(totalTax)} />
            <DocumentMetric label="Order Total" value={formatCurrency(total)} tone="success" />
          </DocumentFormHeader>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <DocumentFormSection
            title="Supplier & Payment"
            description="Choose a supplier, expected payment method, due date, and any amount already paid."
            contentClassName="grid gap-4 md:grid-cols-4"
          >
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Supplier</label>
              <Select value={supplierId} onValueChange={handleSupplierChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__create_supplier__">
                    <span className="flex items-center gap-2 text-primary">
                      <Plus className="h-3.5 w-3.5" />
                      Create new supplier
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Payment</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <Input
              label="Amount Paid"
              type="number"
              step="0.01"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder={String(total)}
            />
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">Balance</p>
              <p
                className={
                  balanceDue > 0
                    ? "text-lg font-semibold text-red-600"
                    : "text-lg font-semibold text-emerald-600"
                }
              >
                {balanceDue > 0 ? formatCurrency(balanceDue) : "Settled"}
              </p>
            </div>
          </DocumentFormSection>

          <DocumentFormSection
            title="Add Products"
            description="Search current inventory by product name or SKU, then add the supplier quantity and cost."
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products or SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="mt-3 max-h-[220px] space-y-1 overflow-y-auto rounded-lg border border-border/80 p-2">
              {filteredProducts.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  <p>{productSearch ? "No products found" : "Type to search products"}</p>
                  {productSearch && (
                    <a
                      href={dashboardHref(pathname, "/inventory", { createProduct: productSearch })}
                      className="mt-3 inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-accent"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create product
                    </a>
                  )}
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Stock: {product.stock} | Last cost:{" "}
                        {formatCurrency(Number(product.purchasePrice))}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </DocumentFormSection>

          <DocumentFormSection
            title="Purchase Lines"
            description="Adjust quantity, supplier unit price, discount, and tax per line."
            actions={
              <span className="text-xs text-muted-foreground">
                {cart.length} line{cart.length === 1 ? "" : "s"}
              </span>
            }
            contentClassName="space-y-3"
          >
            {cart.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Add products from the search panel above.
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => {
                  const lineTaxable = Math.max(0, item.price * item.quantity - item.discount);
                  const lineTax = (lineTaxable * (item.tax || 0)) / 100;
                  const lineTotal = lineTaxable + lineTax;
                  return (
                    <div key={item.productId} className="rounded-lg border border-border/80 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            Inclusive line amount: {formatCurrency(lineTotal)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setCart((prev) => prev.filter((i) => i.productId !== item.productId))
                          }
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-red-500 hover:bg-red-50"
                          aria-label={`Remove ${item.productName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Qty
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setCart((prev) =>
                                  prev
                                    .map((i) =>
                                      i.productId === item.productId
                                        ? { ...i, quantity: Math.max(0, i.quantity - 1) }
                                        : i,
                                    )
                                    .filter((i) => i.quantity > 0),
                                )
                              }
                              className="rounded-md p-2 hover:bg-accent"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={Number.isFinite(item.quantity) ? item.quantity : 1}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) =>
                                setCart((prev) =>
                                  prev.map((i) =>
                                    i.productId === item.productId
                                      ? {
                                          ...i,
                                          quantity: Math.max(
                                            1,
                                            Number.parseInt(e.target.value, 10) || 1,
                                          ),
                                        }
                                      : i,
                                  ),
                                )
                              }
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-right text-sm font-medium"
                              aria-label={`Quantity for ${item.productName}`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setCart((prev) =>
                                  prev.map((i) =>
                                    i.productId === item.productId
                                      ? { ...i, quantity: i.quantity + 1 }
                                      : i,
                                  ),
                                )
                              }
                              className="rounded-md p-2 hover:bg-accent"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <Input
                          label="Unit Price"
                          type="number"
                          min={0}
                          step="0.01"
                          value={Number.isFinite(item.price) ? item.price : 0}
                          onChange={(e) =>
                            setCart((prev) =>
                              prev.map((i) =>
                                i.productId === item.productId
                                  ? {
                                      ...i,
                                      price: Math.max(0, Number.parseFloat(e.target.value) || 0),
                                    }
                                  : i,
                              ),
                            )
                          }
                        />
                        <Input
                          label="Discount"
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.discount || ""}
                          onChange={(e) =>
                            setCart((prev) =>
                              prev.map((i) =>
                                i.productId === item.productId
                                  ? { ...i, discount: parseFloat(e.target.value) || 0 }
                                  : i,
                              ),
                            )
                          }
                        />
                        <Input
                          label={`${taxLabel()} %`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.tax || ""}
                          onChange={(e) =>
                            setCart((prev) =>
                              prev.map((i) =>
                                i.productId === item.productId
                                  ? { ...i, tax: parseFloat(e.target.value) || 0 }
                                  : i,
                              ),
                            )
                          }
                        />
                        <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{taxLabel()} Amount</p>
                          <p className="text-sm font-semibold">{formatCurrency(lineTax)}</p>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                          <p className="text-xs text-muted-foreground">Line Total</p>
                          <p className="text-sm font-semibold">{formatCurrency(lineTotal)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DocumentFormSection>

          <DocumentFormSection
            title="Supplier-Facing Text"
            description="Notes remain with the order; terms print on the purchase order instead of defaults."
            contentClassName="grid gap-4 md:grid-cols-2"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Receiving instructions, supplier reference, or internal note..."
                className={documentTextareaClassName}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Terms & Conditions</label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Delivery terms, payment terms, warranty, accepted substitutions..."
                className={documentTextareaClassName}
              />
            </div>
          </DocumentFormSection>

          <DocumentSummaryPanel>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span>-{formatCurrency(totalDiscount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{taxLabel()}</span>
              <span>{formatCurrency(totalTax)}</span>
            </div>
            <div className="flex justify-between border-t pt-3 text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span>{formatCurrency(amountPaid)}</span>
            </div>
            {balanceDue > 0 && (
              <div className="flex justify-between text-sm font-medium text-red-600">
                <span>Due</span>
                <span>{formatCurrency(balanceDue)}</span>
              </div>
            )}
          </DocumentSummaryPanel>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleSubmit("DRAFT")}
              disabled={loading || cart.length === 0}
            >
              {loading ? (
                <LoadingSpinner size={4} className="mr-2" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isEditing ? "Update Draft" : "Save Draft"}
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleSubmit("RECEIVED")}
              disabled={loading || cart.length === 0}
            >
              {loading ? (
                <LoadingSpinner size={4} className="mr-2" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Receive & Record
            </Button>
          </div>

          {isEditing && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  window.open(
                    `/api/purchase-orders/${purchase.id}?size=A4`,
                    "_blank",
                    "width=800,height=600",
                  )
                }
              >
                <Printer className="mr-2 h-4 w-4" />
                Print A4
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  window.open(
                    `/api/purchase-orders/${purchase.id}?size=THERMAL_80`,
                    "_blank",
                    "width=400,height=600",
                  )
                }
              >
                <Printer className="mr-2 h-4 w-4" />
                Thermal
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
