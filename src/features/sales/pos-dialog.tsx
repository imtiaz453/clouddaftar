"use client";

import { useState, useRef, useEffect } from "react";
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
import { Check, Save, Plus } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCurrency, taxLabel } from "@/lib/utils";
import { dashboardHref } from "@/lib/dashboard-href";
import {
  LineItemEditor,
  type LineItem,
  type ProductOption,
  calculateTotals,
  applyScannedBarcode,
} from "@/components/shared/line-item-editor";
import {
  DocumentFormHeader,
  DocumentFormSection,
  DocumentMetric,
  DocumentSummaryPanel,
  documentTextareaClassName,
} from "@/components/shared/document-form-layout";
import { openA4InvoicePrintWindow, printA4Invoice } from "./print-utils";

interface POSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  customers: { id: string; name: string }[];
  sale?: any;
  defaultTaxRate?: number;
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
    description: "",
  };
}

function saleItemsToLineItems(sale: any, products: ProductOption[]): LineItem[] {
  const items = (sale.items || []).map((item: any) => {
    const product = products.find((p) => p.id === item.productId);
    return {
      id: Math.random().toString(36).substring(2, 10),
      productId: item.productId,
      productName: item.product?.name || product?.name || "Unknown",
      sku: item.product?.sku || product?.sku || "",
      barcode: product?.barcode || "",
      unit: product?.unit || "",
      quantity: item.quantity,
      price: Number(item.price),
      discount: Number(item.discount),
      tax: Number(item.tax),
      stock: product?.stock || 0,
      description: item.description || "",
    };
  });
  return items.length > 0 ? items : [createEmptyRow()];
}

function dateInputValue(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function POSDialog({
  open,
  onOpenChange,
  products,
  customers,
  sale,
  defaultTaxRate,
}: POSDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LineItem[]>([createEmptyRow()]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paid, setPaid] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);
  const autoPaid = useRef(true);

  const isEditing = !!sale;

  const totals = calculateTotals(items, globalDiscount);

  useEffect(() => {
    if (autoPaid.current) setPaid(String(totals.grandTotal));
  }, [totals.grandTotal]);

  useEffect(() => {
    if (open) {
      if (sale) {
        autoPaid.current = false;
        setItems(saleItemsToLineItems(sale, products));
        setCustomerId(sale.customerId || "");
        setPaymentMethod(sale.paymentMethod || "CASH");
        setPaid(String(Number(sale.paid)));
        setDueDate(dateInputValue(sale.dueDate));
        setNotes(sale.notes || "");
        setTerms(sale.terms || "");
        setGlobalDiscount(Number(sale.discount));
      } else {
        autoPaid.current = true;
        setItems([createEmptyRow()]);
        setCustomerId("");
        setPaymentMethod("CASH");
        setPaid("");
        setDueDate("");
        setNotes("");
        setTerms("");
        setGlobalDiscount(0);
      }
      setBarcodeInput("");
      requestAnimationFrame(() => barcodeRef.current?.focus());
    }
  }, [open, sale, products]);

  useEffect(() => {
    const barcode = barcodeInput.trim();
    if (barcode.length > 0 && open) {
      const result = applyScannedBarcode(items, products, barcode, defaultTaxRate);
      if (result.found) {
        setItems(result.items);
        setBarcodeInput("");
        requestAnimationFrame(() => barcodeRef.current?.focus());
      }
    }
  }, [barcodeInput, open, items, products, defaultTaxRate]);

  const amountPaid = Math.max(0, parseFloat(paid) || 0);
  const change = amountPaid - totals.grandTotal;
  const balanceDue = Math.max(0, totals.grandTotal - amountPaid);
  const invoiceFullyPaid = totals.grandTotal > 0 && amountPaid >= totals.grandTotal;
  const validItems = items.filter((i) => i.productId && i.quantity > 0);

  useEffect(() => {
    if (invoiceFullyPaid && dueDate) setDueDate("");
  }, [invoiceFullyPaid, dueDate]);

  function handleCustomerChange(value: string) {
    if (value === "__create_customer__") {
      window.location.assign(dashboardHref(pathname, "/customers"));
      return;
    }
    setCustomerId(value);
  }

  async function handleSubmit(status: string) {
    if (validItems.length === 0) {
      addToast({ title: "Add at least one product", variant: "error" });
      return;
    }

    const printWindow = status === "DRAFT" ? null : openA4InvoicePrintWindow();
    setLoading(true);
    try {
      const url = sale ? `/api/sales/${sale.id}` : "/api/sales";
      const method = sale ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          items: validItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            tax: item.tax,
            description: item.description || undefined,
          })),
          discount: globalDiscount,
          paymentMethod,
          notes: notes || undefined,
          terms: terms || undefined,
          paid: amountPaid,
          dueDate: invoiceFullyPaid ? null : dueDate || null,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const saleId = data.data?.id || sale?.id;

      addToast({
        title: status === "DRAFT" ? "Draft saved" : "Sale completed",
        description: `Invoice ${data.data?.invoiceNumber}`,
        variant: "success",
      });
      if (status !== "DRAFT" && saleId) {
        printA4Invoice(saleId, printWindow);
      } else {
        printWindow?.close();
      }
      onOpenChange(false);
      router.refresh();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[min(1200px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {isEditing ? "Edit Invoice" : "New Invoice"}
          </DialogTitle>
          <DocumentFormHeader
            title={isEditing ? "Edit Invoice" : "New Invoice"}
            subtitle="Customer, payment, line items, tax, notes, and print terms in one workspace."
          >
            <DocumentMetric label="Lines" value={validItems.length} />
            <DocumentMetric label={taxLabel()} value={formatCurrency(totals.totalTax)} />
            <DocumentMetric
              label="Total"
              value={formatCurrency(totals.grandTotal)}
              tone="success"
            />
          </DocumentFormHeader>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <DocumentFormSection
            title="Customer & Payment"
            description="Use walk-in for cash sales, or pick a saved customer when the invoice needs receivables tracking."
            contentClassName="grid gap-4 md:grid-cols-3"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium">Customer</label>
              <Select value={customerId} onValueChange={handleCustomerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Walk-in customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__create_customer__">
                    <span className="flex items-center gap-2 text-primary">
                      <Plus className="h-3.5 w-3.5" />
                      Create new customer
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
                  <SelectItem value="MOBILE_PAYMENT">Mobile Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              label="Amount Paid"
              type="number"
              step="0.01"
              value={paid}
              onChange={(e) => {
                autoPaid.current = false;
                setPaid(e.target.value);
              }}
              placeholder={String(totals.grandTotal)}
            />
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={invoiceFullyPaid}
              placeholder={invoiceFullyPaid ? "Paid in full" : "Due date"}
            />
            <Input
              label="Overall Discount"
              type="number"
              min={0}
              value={globalDiscount}
              onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
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
            title="Items"
            description="Search by name, SKU, or barcode. Unit price, discount, and tax are editable per line."
            actions={
              <span className="text-xs text-muted-foreground">
                {totals.itemCount} line{totals.itemCount === 1 ? "" : "s"}
              </span>
            }
            contentClassName="space-y-3"
          >
            <LineItemEditor
              items={items}
              onChange={setItems}
              products={products}
              showBarcode
              showStock
              barcodeInput={barcodeInput}
              onBarcodeChange={setBarcodeInput}
              barcodeRef={barcodeRef as any}
              defaultTaxRate={defaultTaxRate}
            />
          </DocumentFormSection>

          <DocumentFormSection
            title="Commercial Notes"
            description="These notes and terms print on the invoice instead of falling back to defaults."
            contentClassName="grid gap-4 md:grid-cols-2"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                className={documentTextareaClassName}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Terms & Conditions</label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Payment terms, delivery terms, warranty note, or agreed conditions..."
                className={documentTextareaClassName}
              />
            </div>
          </DocumentFormSection>

          <DocumentSummaryPanel>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span>{totals.itemCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span>-{formatCurrency(totals.totalDiscount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{taxLabel()}</span>
              <span>{formatCurrency(totals.totalTax)}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(totals.grandTotal)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Paid</span>
                <span>{formatCurrency(amountPaid)}</span>
              </div>
              {balanceDue > 0 && (
                <div className="flex justify-between text-sm font-medium text-red-600">
                  <span>Due</span>
                  <span>{formatCurrency(balanceDue)}</span>
                </div>
              )}
              {amountPaid >= totals.grandTotal && amountPaid > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Change</span>
                  <span>{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          </DocumentSummaryPanel>

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="sm:min-w-36"
              onClick={() => handleSubmit("DRAFT")}
              disabled={loading || validItems.length === 0}
            >
              {loading ? (
                <LoadingSpinner size={4} className="mr-2" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isEditing ? "Update Draft" : "Save Draft"}
            </Button>
            <Button
              className="sm:min-w-40"
              size="lg"
              onClick={() => handleSubmit("COMPLETED")}
              disabled={loading || validItems.length === 0}
            >
              {loading ? (
                <LoadingSpinner size={4} className="mr-2" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Complete Sale
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
