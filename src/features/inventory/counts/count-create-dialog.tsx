"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { createStockCountAction, getLocationsForSelect } from "@/actions/inventory-new";

interface LocationOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface CountCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CountCreateDialog({ open, onOpenChange, onCreated }: CountCreateDialogProps) {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (!open) return;
    getLocationsForSelect().then(setLocations).catch(() => {});
  }, [open]);

  function resetForm() {
    setLocationId("");
    setNotes("");
  }

  async function handleSubmit() {
    if (!locationId) {
      addToast({ title: "Location is required", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      await createStockCountAction({
        locationId,
        notes: notes.trim() || null,
      });
      addToast({ title: "Stock count created", variant: "success" });
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      addToast({
        title: "Failed to create stock count",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Stock Count</DialogTitle>
          <DialogDescription>
            Create a stock count to reconcile actual stock with recorded quantities.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">This will snapshot current stock quantities</p>
                <p className="mt-1 text-xs">
                  All stock balances at the selected location will be frozen and used as the
                  expected quantities for the count. You will then count actual stock and record
                  discrepancies.
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder="Optional notes about this stock count"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating..." : "Create Stock Count"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
