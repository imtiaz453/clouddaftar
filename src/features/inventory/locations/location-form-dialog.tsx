"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  createInventoryLocation, updateInventoryLocation,
  getBranchesForSelect, getEmployeesForSelect,
} from "@/actions/inventory";
import { toast } from "sonner";

const LOCATION_TYPES = [
  { value: "MAIN_WAREHOUSE", label: "Main Warehouse" },
  { value: "BRANCH_STORE", label: "Branch Store" },
  { value: "POS_STORE", label: "POS Store" },
  { value: "EMPLOYEE_STORE", label: "Employee Store" },
  { value: "DAMAGED_STORE", label: "Damaged Stock" },
  { value: "RETURN_STORE", label: "Return Stock" },
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

interface LocationFormData {
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

interface LocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: LocationFormData | null;
  onSuccess?: () => void;
}

export function LocationFormDialog({
  open, onOpenChange, location, onSuccess,
}: LocationFormDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; email: string | null }[]>([]);

  const {
    register, handleSubmit, formState: { errors }, reset, setValue, watch,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", code: "", type: "",
      branchId: null, assignedEmployeeId: null,
      isSellable: true, address: "", notes: "",
    },
  });

  const watchType = watch("type");
  const showBranch = watchType === "BRANCH_STORE" || watchType === "POS_STORE";
  const showEmployee = watchType === "EMPLOYEE_STORE";
  const hideSellable = watchType === "DAMAGED_STORE" || watchType === "RETURN_STORE";

  useEffect(() => {
    if (!open) return;
    if (location) {
      reset({
        name: location.name,
        code: location.code,
        type: location.type,
        branchId: location.branchId ?? null,
        assignedEmployeeId: location.assignedEmployeeId ?? null,
        isSellable: location.isSellable ?? true,
        address: location.address ?? "",
        notes: location.notes ?? "",
      });
    } else {
      reset({
        name: "", code: "", type: "",
        branchId: null, assignedEmployeeId: null,
        isSellable: true, address: "", notes: "",
      });
    }
    Promise.all([getBranchesForSelect(), getEmployeesForSelect()])
      .then(([b, e]) => { setBranches(b); setEmployees(e); })
      .catch(() => {});
  }, [open, location, reset]);

  function autoGenerateCode(name: string) {
    if (location) return;
    const code = name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 10);
    if (code) setValue("code", code);
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload = {
        ...values,
        branchId: values.branchId || null,
        assignedEmployeeId: values.assignedEmployeeId || null,
        address: values.address || null,
        notes: values.notes || null,
      };
      if (location) {
        await updateInventoryLocation(location.id, payload as Record<string, unknown>);
        toast.success("Location updated");
      } else {
        await createInventoryLocation(payload);
        toast.success("Location created");
      }
      onSuccess?.();
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(location ? "Error updating location" : "Error creating location", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>{location ? "Edit Location" : "Create Location"}</DialogTitle>
          <DialogDescription>
            {location ? "Update location details" : "Add a new stock location"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Name"
                {...register("name")}
                error={errors.name?.message}
                required
                onChange={(e) => {
                  setValue("name", e.target.value);
                  if (!location) autoGenerateCode(e.target.value);
                }}
              />
              <Input
                label="Code"
                {...register("code")}
                error={errors.code?.message}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={watch("type")}
                onValueChange={(v) => {
                  setValue("type", v);
                  if (v === "DAMAGED_STORE" || v === "RETURN_STORE") setValue("isSellable", false);
                  if (v !== "BRANCH_STORE" && v !== "POS_STORE") setValue("branchId", null);
                  if (v !== "EMPLOYEE_STORE") setValue("assignedEmployeeId", null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-xs font-medium text-destructive">{errors.type.message}</p>
              )}
            </div>

            {showBranch && (
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select
                  value={watch("branchId") ?? ""}
                  onValueChange={(v) => setValue("branchId", v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.branchId && (
                  <p className="text-xs font-medium text-destructive">{errors.branchId.message}</p>
                )}
              </div>
            )}

            {showEmployee && (
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <Select
                  value={watch("assignedEmployeeId") ?? ""}
                  onValueChange={(v) => setValue("assignedEmployeeId", v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}{e.email ? ` (${e.email})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assignedEmployeeId && (
                  <p className="text-xs font-medium text-destructive">{errors.assignedEmployeeId.message}</p>
                )}
              </div>
            )}

            {!hideSellable && (
              <div className="flex items-center gap-3">
                <Switch
                  id="isSellable"
                  checked={watch("isSellable")}
                  onCheckedChange={(v) => setValue("isSellable", v)}
                />
                <Label htmlFor="isSellable" className="text-sm cursor-pointer">
                  Sellable at this location
                </Label>
              </div>
            )}

            <Input
              label="Address"
              {...register("address")}
            />

            <Input
              label="Notes"
              {...register("notes")}
            />
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {location ? "Update Location" : "Create Location"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
