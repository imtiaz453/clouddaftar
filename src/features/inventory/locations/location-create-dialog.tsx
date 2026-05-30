"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/providers/toast-provider";
import {
  createInventoryLocation,
  updateInventoryLocation,
  getBranchesForSelect,
  getEmployeesForSelect,
} from "@/actions/inventory-new";

const LOCATION_TYPES = [
  { value: "MAIN_WAREHOUSE", label: "Main Warehouse" },
  { value: "BRANCH_STORE", label: "Branch Store" },
  { value: "POS_STORE", label: "POS Store" },
  { value: "EMPLOYEE_STORE", label: "Employee Store" },
  { value: "DAMAGED_STORE", label: "Damaged Store" },
  { value: "RETURN_STORE", label: "Return Store" },
] as const;

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    code: z.string().min(1, "Code is required"),
    type: z.string().min(1, "Type is required"),
    branchId: z.string().nullable().optional(),
    assignedEmployeeId: z.string().nullable().optional(),
    isSellable: z.boolean().default(true),
    address: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.type === "BRANCH_STORE" || data.type === "POS_STORE") && !data.branchId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Branch is required for this type", path: ["branchId"] });
    }
    if (data.type === "EMPLOYEE_STORE" && !data.assignedEmployeeId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Employee is required for this type", path: ["assignedEmployeeId"] });
    }
  });

type FormValues = z.infer<typeof formSchema>;

interface EditData {
  id: string;
  name: string;
  code: string;
  type: string;
  branchId?: string | null;
  assignedEmployeeId?: string | null;
  isSellable?: boolean;
  address?: string | null;
  notes?: string | null;
}

interface LocationCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: EditData | null;
}

export function LocationCreateDialog({ open, onOpenChange, onSuccess, editData }: LocationCreateDialogProps) {
  const { addToast } = useToast();
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "",
      branchId: null,
      assignedEmployeeId: null,
      isSellable: true,
      address: "",
      notes: "",
    },
  });

  const watchType = form.watch("type");
  const showBranch = watchType === "BRANCH_STORE" || watchType === "POS_STORE";
  const showEmployee = watchType === "EMPLOYEE_STORE";
  const hideSellable = watchType === "DAMAGED_STORE" || watchType === "RETURN_STORE";

  useEffect(() => {
    if (!open) return;
    if (editData) {
      form.reset({
        name: editData.name,
        code: editData.code,
        type: editData.type,
        branchId: editData.branchId ?? null,
        assignedEmployeeId: editData.assignedEmployeeId ?? null,
        isSellable: editData.isSellable,
        address: editData.address ?? "",
        notes: editData.notes ?? "",
      });
    } else {
      form.reset({
        name: "", code: "", type: "", branchId: null, assignedEmployeeId: null,
        isSellable: true, address: "", notes: "",
      });
    }
    Promise.all([getBranchesForSelect(), getEmployeesForSelect()]).then(([b, e]) => {
      setBranches(b);
      setEmployees(e);
    }).catch(() => {});
  }, [open, editData]);

  function autoGenerateCode(name: string) {
    if (editData) return;
    const code = name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 10);
    if (code) form.setValue("code", code);
  }

  async function handleSubmit(values: FormValues) {
    setLoading(true);
    try {
      if (editData) {
        await updateInventoryLocation(editData.id, values);
        addToast({ title: "Location updated", variant: "success" });
      } else {
        await createInventoryLocation(values);
        addToast({ title: "Location created", variant: "success" });
      }
      onSuccess();
    } catch (err: any) {
      addToast({ title: editData ? "Update failed" : "Creation failed", description: String(err), variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editData ? "Edit Location" : "Create Location"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Name *"
              {...form.register("name")}
              error={form.formState.errors.name?.message}
              onChange={(e) => {
                form.setValue("name", e.target.value);
                if (!editData) autoGenerateCode(e.target.value);
              }}
            />
            <Input
              label="Code *"
              {...form.register("code")}
              error={form.formState.errors.code?.message}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type *</Label>
            <Select
              value={form.watch("type")}
              onValueChange={(v) => {
                form.setValue("type", v);
                if (v !== "BRANCH_STORE" && v !== "POS_STORE") form.setValue("branchId", null);
                if (v !== "EMPLOYEE_STORE") form.setValue("assignedEmployeeId", null);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.filter((t) => typeof t.value === "string" && t.value.trim() !== "").map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.type && (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.type.message}</p>
            )}
          </div>

          {showBranch && (
            <div className="space-y-1.5">
              <Label>Branch *</Label>
              <Select
                value={form.watch("branchId") ?? ""}
                onValueChange={(v) => form.setValue("branchId", v || null)}
              >
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.filter((b) => typeof b.id === "string" && b.id.trim() !== "").map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.branchId && (
                <p className="text-xs font-medium text-destructive">{form.formState.errors.branchId.message}</p>
              )}
            </div>
          )}

          {showEmployee && (
            <div className="space-y-1.5">
              <Label>Employee *</Label>
              <Select
                value={form.watch("assignedEmployeeId") ?? ""}
                onValueChange={(v) => form.setValue("assignedEmployeeId", v || null)}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.filter((e) => typeof e.id === "string" && e.id.trim() !== "").map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}{e.email ? ` (${e.email})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.assignedEmployeeId && (
                <p className="text-xs font-medium text-destructive">{form.formState.errors.assignedEmployeeId.message}</p>
              )}
            </div>
          )}

          {!hideSellable && (
            <div className="flex items-center gap-3">
              <Switch
                id="isSellable"
                checked={form.watch("isSellable")}
                onCheckedChange={(v) => form.setValue("isSellable", v)}
              />
              <Label htmlFor="isSellable">Sellable at this location</Label>
            </div>
          )}

          <Input
            label="Address"
            {...form.register("address")}
          />

          <Input
            label="Notes"
            {...form.register("notes")}
          />

          <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : editData ? "Update Location" : "Create Location"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
