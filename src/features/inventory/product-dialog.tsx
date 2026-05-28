"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/providers/toast-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product, Category } from "@prisma/client";
import { ImageUp, Plus, X } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { taxLabel } from "@/lib/utils";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: (Product & { category?: { name: string } | null }) | null;
  categories: Category[];
  defaultName?: string;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
  defaultName = "",
}: ProductDialogProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<string[]>([]);
  const [customUnit, setCustomUnit] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/units")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setUnits(data.data.map((u: any) => u.name));
        })
        .catch(() => {});
      setCustomUnit(false);
    }
  }, [open]);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    description: "",
    purchasePrice: 0,
    sellingPrice: 0,
    wholesalePrice: 0,
    stock: 0,
    minStock: 10,
    unit: "pcs",
    categoryId: "",
    isService: false,
    trackingMode: "NONE",
    mfgDate: "",
    expiryDate: "",
    tax: 0,
    image: "",
  });
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    setForm({
      name: product?.name || defaultName || "",
      sku: product?.sku || "",
      barcode: product?.barcode || "",
      description: product?.description || "",
      purchasePrice: Number(product?.purchasePrice) || 0,
      sellingPrice: Number(product?.sellingPrice) || 0,
      wholesalePrice: Number(product?.wholesalePrice) || 0,
      stock: product?.stock || 0,
      minStock: product?.minStock ?? 10,
      unit: product?.unit || "pcs",
      categoryId: product?.categoryId || "",
      isService: product?.isService || false,
      trackingMode: (product as any)?.trackingMode || "NONE",
      mfgDate: (product as any)?.mfgDate ? ((product as any).mfgDate as string).slice(0, 10) : "",
      expiryDate: (product as any)?.expiryDate ? ((product as any).expiryDate as string).slice(0, 10) : "",
      tax: Number(product?.tax) || 0,
      image: product?.image || "",
    });
  }, [product, defaultName]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast({ title: "Please select an image file", variant: "error" });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      addToast({ title: "Image must be under 4MB", variant: "error" });
      return;
    }
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "productImage");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload image");
      }

      setForm((current) => ({ ...current, image: data.url }));
      addToast({ title: "Image uploaded", variant: "success" });
    } catch (err) {
      addToast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed to upload image",
        variant: "error",
      });
    } finally {
      setImageUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/inventory", {
        method: product ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, categoryId: form.categoryId || null, id: product?.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addToast({
        title: product ? "Product updated" : "Product created",
        variant: "success",
      });
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
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription>
            {product ? "Update product details" : "Add a new product to your inventory"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Product Image</label>
                <div className="flex items-center gap-4">
                  {form.image ? (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border">
                      <img src={form.image} alt="Preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image: "" })}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed bg-muted/30">
                      <ImageUp className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent">
                    {imageUploading ? (
                      <LoadingSpinner size={4} />
                    ) : (
                      <ImageUp className="h-4 w-4" />
                    )}
                    {form.image ? "Change" : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageUpload}
                      disabled={imageUploading}
                    />
                  </label>
                </div>
              </div>
              <Input
                label="Product Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="SKU"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="Auto-generated if empty"
              />
              <Input
                label="Barcode"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium">Traceability</label>
                <Select
                  value={form.trackingMode}
                  onValueChange={(v) => setForm({ ...form, trackingMode: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No lot or serial tracking</SelectItem>
                    <SelectItem value="LOT">Track by lot number</SelectItem>
                    <SelectItem value="SERIAL">Track by serial number</SelectItem>
                    <SelectItem value="BATCH">Track by batch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Category</label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.trackingMode !== "NONE" && (
                <>
                  <Input
                    label="Manufacturing Date (MFG)"
                    type="date"
                    value={form.mfgDate}
                    onChange={(e) => setForm({ ...form, mfgDate: e.target.value })}
                  />
                  <Input
                    label="Expiry Date (EXP)"
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  />
                </>
              )}
              <Input
                label="Purchase Price"
                type="number"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) =>
                  setForm({ ...form, purchasePrice: parseFloat(e.target.value) || 0 })
                }
                required
              />
              <Input
                label="Selling Price"
                type="number"
                step="0.01"
                value={form.sellingPrice}
                onChange={(e) =>
                  setForm({ ...form, sellingPrice: parseFloat(e.target.value) || 0 })
                }
                required
              />
              <Input
                label="Wholesale Price"
                type="number"
                step="0.01"
                value={form.wholesalePrice}
                onChange={(e) =>
                  setForm({ ...form, wholesalePrice: parseFloat(e.target.value) || 0 })
                }
              />
              <Input
                label="Current Stock"
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                required
              />
              <Input
                label="Min Stock Level"
                type="number"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })}
              />
              {units.length > 0 && !customUnit ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Unit</label>
                  <div className="flex gap-2">
                    <Select
                      value={form.unit}
                      onValueChange={(v) => {
                        if (v === "__custom__") {
                          setCustomUnit(true);
                          setForm({ ...form, unit: "" });
                        } else {
                          setForm({ ...form, unit: v });
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">
                          <div className="flex items-center gap-2 text-primary">
                            <Plus className="h-3.5 w-3.5" />
                            Custom unit...
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <Input
                  label="Unit"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              )}
              {units.length > 0 && !customUnit && (
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...form, unit: "" });
                    setCustomUnit(true);
                  }}
                  className="-mt-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  Or type a custom unit
                </button>
              )}
              <Input
                label={`${taxLabel()} (%)`}
                type="number"
                step="0.01"
                value={form.tax}
                onChange={(e) => setForm({ ...form, tax: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="isService"
                checked={form.isService}
                onChange={(e) => setForm({ ...form, isService: e.target.checked })}
                className="rounded border-input"
              />
              <label htmlFor="isService" className="text-sm">
                This is a service (not a physical product)
              </label>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <LoadingSpinner size={4} className="mr-2" />}
              {product ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
