"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ImageUp, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { createProduct, updateProduct } from "@/actions/inventory";
import { toast } from "sonner";
import { taxLabel } from "@/lib/utils";

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  purchasePrice: z.coerce.number().min(0, "Must be 0 or more"),
  sellingPrice: z.coerce.number().min(0, "Must be 0 or more"),
  wholesalePrice: z.coerce.number().optional(),
  tax: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
  maxStock: z.coerce.number().min(0).optional(),
  isService: z.boolean().default(false),
  trackingMode: z.enum(["NONE", "LOT", "SERIAL"]).default("NONE"),
  image: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface CategoryOption {
  id: string;
  name: string;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    description: string | null;
    image: string | null;
    unit: string;
    categoryId: string | null;
    purchasePrice: number;
    sellingPrice: number;
    wholesalePrice: number | null;
    tax: number;
    minStock: number;
    maxStock: number | null;
    isService: boolean;
    trackingMode: string;
  } | null;
  categories: CategoryOption[];
  defaultName?: string;
  onSuccess?: () => void;
}

export function ProductFormDialog({
  open, onOpenChange, product, categories, defaultName, onSuccess,
}: ProductFormDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [units, setUnits] = useState<string[]>([]);
  const [customUnit, setCustomUnit] = useState(false);

  const {
    register, handleSubmit, formState: { errors }, reset, setValue, watch,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "", sku: "", barcode: "", description: "",
      categoryId: "", unit: "pcs",
      purchasePrice: 0, sellingPrice: 0, wholesalePrice: 0,
      tax: 0, minStock: 0, maxStock: 0,
      isService: false, trackingMode: "NONE", image: "",
    },
  });

  const watchIsService = watch("isService");
  const watchImage = watch("image");
  const watchTrackingMode = watch("trackingMode");

  useEffect(() => {
    if (!open) return;
    if (product) {
      reset({
        name: product.name,
        sku: product.sku || "",
        barcode: product.barcode || "",
        description: product.description || "",
        categoryId: product.categoryId || "",
        unit: product.unit || "pcs",
        purchasePrice: Number(product.purchasePrice) || 0,
        sellingPrice: Number(product.sellingPrice) || 0,
        wholesalePrice: Number(product.wholesalePrice) || 0,
        tax: Number(product.tax) || 0,
        minStock: Number(product.minStock) || 0,
        maxStock: Number(product.maxStock) || 0,
        isService: product.isService || false,
        trackingMode: (product.trackingMode as "NONE" | "LOT" | "SERIAL") || "NONE",
        image: product.image || "",
      });
    } else {
      reset({
        name: defaultName || "", sku: "", barcode: "", description: "",
        categoryId: "", unit: "pcs",
        purchasePrice: 0, sellingPrice: 0, wholesalePrice: 0,
        tax: 0, minStock: 0, maxStock: 0,
        isService: false, trackingMode: "NONE", image: "",
      });
    }
    setCustomUnit(false);
  }, [open, product, defaultName, reset]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/units")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUnits(data.data.map((u: any) => u.name));
      })
      .catch(() => {});
  }, [open]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4MB");
      return;
    }
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "productImage");
      const res = await fetch("/api/upload", {
        method: "POST", body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
      setValue("image", data.url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setImageUploading(false);
    }
  }

  async function onSubmit(values: ProductFormValues) {
    setSaving(true);
    try {
      const payload = {
        ...values,
        categoryId: values.categoryId || null,
        wholesalePrice: values.wholesalePrice || undefined,
        maxStock: values.maxStock || undefined,
        image: values.image || undefined,
      };
      if (product) {
        await updateProduct(product.id, payload as unknown as Record<string, unknown>);
        toast.success("Product updated");
      } else {
        await createProduct(payload);
        toast.success("Product created");
      }
      onSuccess?.();
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
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

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium">Product Image</label>
              <div className="flex items-center gap-4">
                {watchImage ? (
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border">
                    <img src={watchImage} alt="Preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setValue("image", "")}
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
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageUp className="h-4 w-4" />
                  )}
                  {watchImage ? "Change" : "Upload"}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Input
                  label="Product Name"
                  {...register("name")}
                  error={errors.name?.message}
                  required
                />
              </div>
              <Input
                label="SKU"
                {...register("sku")}
                placeholder="Auto-generated if empty"
              />
              <Input
                label="Barcode"
                {...register("barcode")}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium">Category</label>
                <Select
                  value={watch("categoryId") || ""}
                  onValueChange={(v) => setValue("categoryId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter((cat) => typeof cat.id === "string" && cat.id.trim() !== "").map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Description"
                  {...register("description")}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Tracking Mode</label>
                <Select
                  value={watchTrackingMode}
                  onValueChange={(v: "NONE" | "LOT" | "SERIAL") => setValue("trackingMode", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No tracking</SelectItem>
                    <SelectItem value="LOT">Track by lot number</SelectItem>
                    <SelectItem value="SERIAL">Track by serial number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                {units.length > 0 && !customUnit ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Unit</label>
                    <div className="flex gap-2">
                      <Select
                        value={watch("unit")}
                        onValueChange={(v) => {
                          if (v === "__custom__") {
                            setCustomUnit(true);
                            setValue("unit", "");
                          } else {
                            setValue("unit", v);
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {units.filter((unit) => typeof unit === "string" && unit.trim() !== "").map((unit) => (
                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                          ))}
                          <SelectItem value="__custom__">
                            <div className="flex items-center gap-2 text-primary">
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
                    {...register("unit")}
                    error={errors.unit?.message}
                    placeholder="e.g. pcs, kg, box"
                    required
                  />
                )}
              </div>
              <Input
                label="Purchase Price"
                type="number"
                step="0.01"
                {...register("purchasePrice")}
                error={errors.purchasePrice?.message}
                required
              />
              <Input
                label="Selling Price"
                type="number"
                step="0.01"
                {...register("sellingPrice")}
                error={errors.sellingPrice?.message}
                required
              />
              <Input
                label="Wholesale Price"
                type="number"
                step="0.01"
                {...register("wholesalePrice")}
              />
              <Input
                label={`${taxLabel()} (%)`}
                type="number"
                step="0.01"
                {...register("tax")}
              />
              <Input
                label="Min Stock Level"
                type="number"
                {...register("minStock")}
              />
              <Input
                label="Max Stock Level"
                type="number"
                {...register("maxStock")}
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Switch
                id="isService"
                checked={watchIsService}
                onCheckedChange={(checked) => setValue("isService", checked)}
              />
              <Label htmlFor="isService" className="text-sm cursor-pointer">
                This is a service (not a physical product)
              </Label>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {product ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
