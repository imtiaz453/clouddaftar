"use client";

import { useEffect, useState } from "react";
import { Search, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  minStock: number;
  unit: string | null;
  purchasePrice: number;
}

interface AdjustmentsClientProps {
  products: Product[];
}

const adjustmentTypes = [
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "RETURN", label: "Return" },
  { value: "DAMAGE", label: "Damage" },
  { value: "LOST", label: "Lost" },
  { value: "FOUND", label: "Found" },
];

export function AdjustmentsClient({ products: initialProducts }: AdjustmentsClientProps) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [type, setType] = useState("ADJUSTMENT");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase()),
  );

  const openAdjust = (product: Product) => {
    setSelectedProduct(product);
    setQuantity(0);
    setType("ADJUSTMENT");
    setNotes("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedProduct || quantity === 0) {
      addToast({ title: "Enter a non-zero quantity", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/adjust-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct.id, quantity, type, notes }),
      });
      if (res.ok) {
        addToast({ title: "Stock adjusted", variant: "success" });
        setProducts((prev) =>
          prev.map((p) => (p.id === selectedProduct.id ? { ...p, stock: p.stock + quantity } : p)),
        );
        setDialogOpen(false);
      } else {
        const d = await res.json();
        addToast({ title: d.error || "Failed", variant: "error" });
      }
    } catch {
      addToast({ title: "Failed to adjust stock", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-8"
        />
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead className="text-right">Min Stock</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {p.name}
                      {p.stock <= p.minStock && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.sku || "—"}</TableCell>
                  <TableCell
                    className={`text-right font-bold ${p.stock <= p.minStock ? "text-red-600" : ""}`}
                  >
                    {p.stock}
                  </TableCell>
                  <TableCell className="text-right">{p.minStock}</TableCell>
                  <TableCell className="text-sm">{p.unit || "—"}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(p.stock * p.purchasePrice)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => openAdjust(p)}
                    >
                      Adjust
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock — {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Current Stock:</span>{" "}
                  <strong>{selectedProduct.stock}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">SKU:</span> {selectedProduct.sku || "—"}
                </div>
              </div>
              <div>
                <Label className="text-xs">Quantity (±)</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  className="h-9"
                  placeholder="Positive to add, negative to remove"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Result: <strong>{selectedProduct.stock + quantity}</strong> units
                  {selectedProduct.stock + quantity < 0 && (
                    <span className="text-red-500"> (negative!)</span>
                  )}
                </p>
              </div>
              <div>
                <Label className="text-xs">Reason</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {adjustmentTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9"
                  placeholder="Optional notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || quantity === 0}>
              {saving ? "Saving..." : quantity > 0 ? "Add Stock" : "Remove Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
