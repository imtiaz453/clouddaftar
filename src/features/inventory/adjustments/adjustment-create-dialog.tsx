"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/providers/toast-provider";
import { createStockAdjustmentAction, getLocationsForSelect, getProductsForSelector } from "@/actions/inventory";

interface LocationOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string | null;
}

interface AdjustmentItemForm {
  productId: string;
  productName: string;
  productSku: string | null;
  direction: "IN" | "OUT";
  quantity: number;
  unitCost: number | undefined;
}

const reasonOptions = [
  { value: "OPENING_BALANCE", label: "Opening Balance" },
  { value: "CORRECTION", label: "Correction" },
  { value: "DAMAGE", label: "Damage" },
  { value: "EXPIRED", label: "Expired" },
  { value: "LOST", label: "Lost" },
  { value: "FOUND", label: "Found" },
  { value: "INTERNAL_USE", label: "Internal Use" },
];

interface AdjustmentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function AdjustmentCreateDialog({ open, onOpenChange, onCreated }: AdjustmentCreateDialogProps) {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<AdjustmentItemForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (!open) return;
    getLocationsForSelect().then(setLocations).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!productSearch.trim()) {
      setProductResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await getProductsForSelector(productSearch);
        setProductResults(results as ProductOption[]);
      } catch {
        setProductResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  function resetForm() {
    setLocationId("");
    setReason("");
    setNotes("");
    setItems([]);
    setProductSearch("");
    setProductResults([]);
  }

  function addItem(product: ProductOption) {
    if (items.some((i) => i.productId === product.id)) {
      addToast({ title: "Product already added", variant: "warning" });
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        direction: "IN",
        quantity: 1,
        unitCost: undefined,
      },
    ]);
    setProductSearch("");
    setProductOpen(false);
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function updateItem(productId: string, updates: Partial<AdjustmentItemForm>) {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, ...updates } : i)));
  }

  async function handleSubmit() {
    const errors: string[] = [];
    if (!locationId) errors.push("Location is required");
    if (!reason) errors.push("Reason is required");
    if (items.length === 0) errors.push("At least one item is required");
    for (const item of items) {
      if (item.quantity <= 0) errors.push(`Quantity must be > 0 for ${item.productName}`);
      if (item.direction === "OUT" && !notes.trim()) errors.push("Notes are required when adjusting OUT");
    }
    if (errors.length > 0) {
      addToast({ title: errors[0], variant: "error" });
      return;
    }

    setSaving(true);
    try {
      await createStockAdjustmentAction({
        locationId,
        reason,
        notes: notes.trim() || null,
        items: items.map((i) => ({
          productId: i.productId,
          direction: i.direction,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      });
      addToast({ title: "Adjustment created", variant: "success" });
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      addToast({
        title: "Failed to create adjustment",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  const hasOutItems = items.some((i) => i.direction === "OUT");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Stock Adjustment</DialogTitle>
          <DialogDescription>
            Record a manual stock adjustment for a specific reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.filter((loc) => typeof loc.id === "string" && loc.id.trim() !== "").map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {reasonOptions.filter((opt) => typeof opt.value === "string" && opt.value.trim() !== "").map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Add Items</Label>
            <div className="relative" ref={productRef}>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductOpen(true);
                  }}
                  onFocus={() => setProductOpen(true)}
                  className="h-9 pl-8"
                />
              </div>
              {productOpen && (productSearch || productResults.length > 0) && (
                <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border bg-background shadow-lg">
                  {searching ? (
                    <div className="p-2 text-sm text-muted-foreground">Searching...</div>
                  ) : productResults.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No products found</div>
                  ) : (
                    productResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => addItem(p)}
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{p.name}</span>
                        {p.sku && (
                          <span className="shrink-0 text-xs text-muted-foreground">{p.sku}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Items ({items.length})</p>
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex flex-wrap items-end gap-2 rounded-lg border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.productName}</p>
                    {item.productSku && (
                      <p className="font-mono text-xs text-muted-foreground">{item.productSku}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant={item.direction === "IN" ? "default" : "outline"}
                      size="sm"
                      className={`h-7 text-xs ${item.direction === "IN" ? "bg-green-600 hover:bg-green-700" : ""}`}
                      onClick={() => updateItem(item.productId, { direction: "IN" })}
                    >
                      IN
                    </Button>
                    <Button
                      type="button"
                      variant={item.direction === "OUT" ? "default" : "outline"}
                      size="sm"
                      className={`h-7 text-xs ${item.direction === "OUT" ? "bg-red-600 hover:bg-red-700" : ""}`}
                      onClick={() => updateItem(item.productId, { direction: "OUT" })}
                    >
                      OUT
                    </Button>
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity || ""}
                      onChange={(e) =>
                        updateItem(item.productId, { quantity: parseInt(e.target.value) || 0 })
                      }
                      className="h-7 text-xs"
                      placeholder="Qty"
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitCost ?? ""}
                      onChange={(e) =>
                        updateItem(item.productId, {
                          unitCost: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      className="h-7 text-xs"
                      placeholder="Unit cost"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={() => removeItem(item.productId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div>
            <Label>
              Notes {hasOutItems && <span className="text-destructive">*</span>}
            </Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={hasOutItems ? "Required for OUT adjustments" : "Optional notes"}
            />
            {hasOutItems && (
              <p className="mt-1 text-xs text-muted-foreground">
                Notes are required when adjusting stock out.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating..." : "Create Adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
