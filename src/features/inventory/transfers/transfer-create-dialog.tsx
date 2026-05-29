"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/providers/toast-provider";
import { createStockTransferAction } from "@/actions/inventory-new";

interface Location {
  id: string;
  name: string;
  code: string;
  [key: string]: unknown;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
}

interface TransferItem {
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  availableStock: number;
}

interface TransferCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
}

export function TransferCreateDialog({
  open,
  onOpenChange,
  locations,
}: TransferCreateDialogProps) {
  const router = useRouter();
  const { addToast } = useToast();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [sourceLocationId, setSourceLocationId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [notes, setNotes] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<TransferItem[]>([]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSourceLocationId("");
      setDestinationLocationId("");
      setNotes("");
      setProductSearch("");
      setItems([]);
      setProducts([]);
    }
  }, [open]);

  const loadProducts = useCallback(async (search: string) => {
    try {
      const res = await fetch(
        `/api/inventory/products/for-select?search=${encodeURIComponent(search)}&take=50`,
      );
      const json = await res.json();
      setProducts(json.data ?? json ?? []);
    } catch {
      addToast({ title: "Failed to load products", variant: "error" });
    }
  }, [addToast]);

  useEffect(() => {
    if (!open || step !== 2) return;
    loadProducts("");
  }, [open, step, loadProducts]);

  async function loadStock(productId: string): Promise<number> {
    try {
      const res = await fetch(
        `/api/inventory/product-stock?productId=${productId}&locationId=${sourceLocationId}`,
      );
      const json = await res.json();
      return Number(json.available ?? json.qtyAvailable ?? 0);
    } catch {
      return 0;
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      !items.find((i) => i.productId === p.id) &&
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.sku ?? "").toLowerCase().includes(productSearch.toLowerCase())),
  );

  async function addProduct(product: Product) {
    const availableStock = await loadStock(product.id);
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        availableStock,
      },
    ]);
    setProductSearch("");
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function updateQuantity(productId: string, qty: number) {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)),
    );
  }

  const locationsError =
    sourceLocationId && destinationLocationId && sourceLocationId === destinationLocationId
      ? "Source and destination locations must differ"
      : null;

  const canAddProducts = sourceLocationId && destinationLocationId && !locationsError;
  const canSubmit =
    items.length > 0 && items.every((i) => i.quantity > 0 && i.quantity <= i.availableStock);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await createStockTransferAction({
        sourceLocationId,
        destinationLocationId,
        notes: notes || null,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      addToast({ title: "Transfer created", variant: "success" });
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      addToast({
        title: "Failed to create transfer",
        description: String(err),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function nextStep() {
    if (canAddProducts) setStep(2);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Stock Transfer</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              <span className={`text-sm ${step >= s ? "text-foreground" : "text-muted-foreground"}`}>
                {s === 1 ? "Locations" : "Products"}
              </span>
              {s < 2 && <Separator className="w-6" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Source Location</Label>
              <Select value={sourceLocationId} onValueChange={setSourceLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Destination Location</Label>
              <Select value={destinationLocationId} onValueChange={setDestinationLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {locationsError && (
              <p className="text-sm font-medium text-destructive">{locationsError}</p>
            )}

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this transfer"
                rows={3}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {productSearch && filteredProducts.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>{p.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{p.sku ?? "—"}</span>
                  </button>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Items ({items.length})
                </p>
                <div className="rounded-lg border">
                  <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
                    <span>Product</span>
                    <span>Available</span>
                    <span>Quantity</span>
                    <span></span>
                  </div>
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="grid grid-cols-[1fr_auto] gap-2 border-b px-3 py-2 last:border-0 sm:grid-cols-[1fr_auto_auto_auto]"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.sku ?? "—"}</p>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground sm:justify-center">
                        {item.availableStock}
                      </div>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          min={1}
                          max={item.availableStock}
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(item.productId, Number(e.target.value))
                          }
                          className="h-8 w-20 text-center"
                        />
                      </div>
                      <div className="flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeItem(item.productId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {item.quantity > item.availableStock && (
                        <p className="col-span-full text-xs font-medium text-destructive">
                          Exceeds available stock ({item.availableStock})
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 && (
              <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
                <Package className="mb-2 h-8 w-8" />
                <p>Search and select products to add to this transfer</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          {step === 1 ? (
            <Button onClick={nextStep} disabled={!canAddProducts}>
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
              {saving ? <LoadingSpinner size={4} /> : "Create Transfer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
