"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Palette } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  slug: string | null;
  _count?: { products: number };
}

interface CategoriesClientProps {
  categories: Category[];
}

export function CategoriesClient({ categories: initial }: CategoriesClientProps) {
  const [categories, setCategories] = useState(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    setCategories(initial);
  }, [initial]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setColor("#3b82f6");
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description || "");
    setColor(cat.color || "#3b82f6");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      addToast({ title: "Name is required", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/inventory/categories`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, name, description, color }),
        });
        if (res.ok) {
          addToast({ title: "Category updated", variant: "success" });
          setCategories((prev) =>
            prev.map((c) => (c.id === editing.id ? { ...c, name, description, color } : c)),
          );
          setDialogOpen(false);
        } else {
          const d = await res.json();
          addToast({ title: d.error || "Failed", variant: "error" });
        }
      } else {
        const res = await fetch("/api/inventory/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, color }),
        });
        if (res.ok) {
          const d = await res.json();
          addToast({ title: "Category created", variant: "success" });
          setCategories((prev) => [...prev, d.data]);
          setDialogOpen(false);
        } else {
          const d = await res.json();
          addToast({ title: d.error || "Failed", variant: "error" });
        }
      }
    } catch {
      addToast({ title: "Failed to save category", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={openCreate}>
        <Plus className="mr-1 h-4 w-4" />
        New Category
      </Button>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Color</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No categories yet
                </TableCell>
              </TableRow>
            ) : (
              categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-full border"
                        style={{ backgroundColor: cat.color || "#888" }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="font-mono text-xs">{cat.slug || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {cat.description || "—"}
                  </TableCell>
                  <TableCell className="text-right">{(cat as any)._count?.products || 0}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(cat)}
                      title="Edit category"
                    >
                      <Pencil className="h-3.5 w-3.5" />
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
            <DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9"
                placeholder="Category name"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9"
                placeholder="Optional description"
              />
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-16 p-1"
                />
                <span className="text-xs text-muted-foreground">{color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
