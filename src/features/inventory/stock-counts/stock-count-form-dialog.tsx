"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Search, Plus, MoreHorizontal, Eye, ArrowUpDown, Truck, CheckCircle, XCircle, Loader2, AlertCircle, Package, ClipboardList, FileText, TrendingUp, AlertTriangle, Calendar, Clock, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createStockCountAction, getLocationsForSelect } from "@/actions/inventory";
import { toast } from "sonner";

interface LocationOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface StockCountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function StockCountFormDialog({ open, onOpenChange, onCreated }: StockCountFormDialogProps) {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

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
      toast.error("Location is required");
      return;
    }
    setSaving(true);
    try {
      await createStockCountAction({
        locationId,
        notes: notes.trim() || null,
      });
      toast.success("Stock count created");
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error("Failed to create stock count", {
        description: err instanceof Error ? err.message : undefined,
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
                {locations.length === 0 ? (
                  <SelectItem value="__loading" disabled>Loading...</SelectItem>
                ) : (
                  locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </SelectItem>
                  ))
                )}
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
          <Button variant="outline" onClick={() => {
            resetForm();
            onOpenChange(false);
          }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Stock Count"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
