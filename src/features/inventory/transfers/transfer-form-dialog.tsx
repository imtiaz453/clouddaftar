"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, X, Package, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  createStockTransferAction,
  getLocationsForSelect,
  getProductsForSelector,
} from "@/actions/inventory";

interface Location {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface ProductItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
}

interface TransferFormItem {
  productId: string;
  productName: string;
  sku: string | null;
  unit: string;
  quantity: number;
}

interface TransferFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferFormDialog({ open, onOpenChange }: TransferFormDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [locations, setLocations] = useState<Location[]>([]);
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [notes, setNotes] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProductItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<TransferFormItem[]>([]);

  useEffect(() => {
    if (!open) {
      setSourceLocationId("");
      setDestinationLocationId("");
      setNotes("");
      setProductSearch("");
      setItems([]);
      setSearchResults([]);
      return;
    }
    getLocationsForSelect()
      .then((locs) => setLocations(locs as unknown as Location[]))
      .catch(() => toast.error("Failed to load locations"));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (!productSearch.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      getProductsForSelector(productSearch)
        .then((prods) => setSearchResults(prods as unknown as ProductItem[]))
        .catch(() => toast.error("Failed to search products"))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, open]);

  const locationsError =
    sourceLocationId && destinationLocationId && sourceLocationId === destinationLocationId
      ? "Source and destination locations must be different"
      : null;

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const canSubmit =
    sourceLocationId &&
    destinationLocationId &&
    !locationsError &&
    items.length > 0 &&
    items.every((i) => i.quantity > 0);

  function addItem(product: ProductItem) {
    if (items.find((i) => i.productId === product.id)) {
      toast.error("Product already added");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unit: product.unit,
        quantity: 1,
      },
    ]);
    setProductSearch("");
    setSearchResults([]);
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function updateQuantity(productId: string, qty: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i,
      ),
    );
  }

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
      toast.success("Transfer created successfully");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error("Failed to create transfer", { description: String(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Stock Transfer</DialogTitle>
          <DialogDescription>
            Move stock between locations. Source and destination must differ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Source Location</Label>
              <Select value={sourceLocationId} onValueChange={setSourceLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
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
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {locations
                    .filter((l) => l.id !== sourceLocationId)
                    .map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {locationsError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {locationsError}
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <Label>Products</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products by name or SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {searchResults.length > 0 && (
              <Card className="max-h-48 overflow-y-auto border">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addItem(p)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-accent border-b last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {p.sku || "—"}
                      </span>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </Card>
            )}

            {items.length > 0 && (
              <div className="rounded-lg border">
                <div className="grid grid-cols-[1fr_80px_32px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Product</span>
                  <span className="text-center">Qty</span>
                  <span />
                </div>
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="grid grid-cols-[1fr_80px_32px] gap-2 items-center border-b px-3 py-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.sku || "—"} · {item.unit}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.productId, parseInt(e.target.value) || 1)
                      }
                      className="h-8 text-center"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.productId)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {items.length === 0 && (
              <div className="flex flex-col items-center py-6 text-center text-sm text-muted-foreground">
                <Package className="mb-2 h-8 w-8 opacity-40" />
                <p>Search and select products to add</p>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </span>
              <span className="font-medium tabular-nums">
                Total qty: {totalQty}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for transfer, reference notes, etc."
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Transfer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
