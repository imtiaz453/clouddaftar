"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Save } from "lucide-react";

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  isActive: boolean;
}

export function UnitsTab() {
  const router = useRouter();
  const { addToast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [form, setForm] = useState({ name: "", abbreviation: "" });
  const [saving, setSaving] = useState(false);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/units");
      const data = await res.json();
      if (data.success) setUnits(data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  function openNew() {
    setEditingUnit(null);
    setForm({ name: "", abbreviation: "" });
    setDialogOpen(true);
  }

  function openEdit(unit: Unit) {
    setEditingUnit(unit);
    setForm({ name: unit.name, abbreviation: unit.abbreviation });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast({ title: "Unit name is required", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const method = editingUnit ? "PUT" : "POST";
      const body = editingUnit
        ? { id: editingUnit.id, name: form.name.trim(), abbreviation: form.abbreviation.trim() }
        : { name: form.name.trim(), abbreviation: form.abbreviation.trim() };
      const res = await fetch("/api/units", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast({
        title: editingUnit ? "Unit updated" : "Unit created",
        variant: "success",
      });
      setDialogOpen(false);
      fetchUnits();
      router.refresh();
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(unit: Unit) {
    if (!confirm(`Delete unit "${unit.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/units", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: unit.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast({ title: "Unit deleted", variant: "success" });
      fetchUnits();
      router.refresh();
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "error",
      });
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Measurement Units</CardTitle>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add Unit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : units.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No units created yet. Add units like pcs, kg, meter, liter, box, etc.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Abbreviation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell className="text-muted-foreground">{unit.abbreviation || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={unit.isActive ? "success" : "secondary"}>
                        {unit.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(unit)} title="Edit unit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(unit)} title="Delete unit">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnit ? "Edit Unit" : "Add Unit"}</DialogTitle>
            <DialogDescription>
              {editingUnit ? "Update the unit name or abbreviation" : "Create a new measurement unit for products"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Unit Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Kilogram, Meter, Box"
              required
            />
            <Input
              label="Abbreviation"
              value={form.abbreviation}
              onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
              placeholder="e.g. kg, m, box"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {editingUnit ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
