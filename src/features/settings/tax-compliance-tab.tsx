"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanySettings, ZatcaEgsUnit, ZatcaSetting } from "@prisma/client";
import { Cable, KeyRound, Loader2, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/providers/toast-provider";

type LegacyZatcaSettings = {
  sellerName?: string;
  vatRegNo?: string;
  crNo?: string;
  address?: string;
  mode?: string;
  otp?: string;
  deviceName?: string;
  branchName?: string;
};

interface TaxComplianceTabProps {
  settings?: CompanySettings | null;
  zatcaSetting?: ZatcaSetting | null;
  egsUnits?: ZatcaEgsUnit[];
}

function formatStatus(status?: string | null) {
  return status?.replaceAll("_", " ").toLowerCase() || "draft";
}

export function TaxComplianceTab({
  settings,
  zatcaSetting,
}: TaxComplianceTabProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [zatcaAction, setZatcaAction] = useState<string | null>(null);
  const fbrCreds = (settings?.fbrCredentials as { username?: string; password?: string }) || {};
  const legacyZatca = (settings?.zatcaSettings as LegacyZatcaSettings | null) || {};

  const [form, setForm] = useState({
    taxComplianceMode: settings?.taxComplianceMode || "NONE",
    fbrUsername: fbrCreds.username || "",
    fbrPassword: fbrCreds.password || "",
    fbrPosId: settings?.fbrPosId || "",
    zatcaEnabled: zatcaSetting?.enabled ?? settings?.taxComplianceMode === "ZATCA",
    zatcaMode: zatcaSetting?.mode || legacyZatca.mode || "LOCAL",
    sellerVatNumber: zatcaSetting?.sellerVatNumber || legacyZatca.vatRegNo || "",
    sellerName: zatcaSetting?.sellerName || legacyZatca.sellerName || "",
    branchName: zatcaSetting?.branchName || legacyZatca.branchName || "",
    crNumber: zatcaSetting?.crNumber || legacyZatca.crNo || "",
    address: zatcaSetting?.address || legacyZatca.address || "",
    deviceName: zatcaSetting?.deviceName || legacyZatca.deviceName || "Cloud Daftar EGS",
    otp: zatcaSetting?.otp || legacyZatca.otp || "",
  });

  async function saveSettings() {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        _type: "tax-compliance",
        taxComplianceMode:
          form.taxComplianceMode === "FBR" ? "FBR" : form.zatcaEnabled ? "ZATCA" : "NONE",
        fbrCredentials: { username: form.fbrUsername, password: form.fbrPassword },
        fbrPosId: form.fbrPosId,
        zatcaSettings: {
          enabled: form.zatcaEnabled,
          mode: form.zatcaMode,
          sellerName: form.sellerName,
          vatRegNo: form.sellerVatNumber,
          branchName: form.branchName,
          crNo: form.crNumber,
          address: form.address,
          deviceName: form.deviceName,
          otp: form.otp,
          phaseMode: form.zatcaMode === "LOCAL" ? "PHASE_1" : "PHASE_2",
        },
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Failed to save tax compliance settings");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettings();
      addToast({ title: "Tax compliance settings saved", variant: "success" });
      router.refresh();
    } catch (error) {
      addToast({
        title: "Settings could not be saved",
        description: error instanceof Error ? error.message : "Review the settings.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function runZatcaAction(action: string) {
    setZatcaAction(action);
    try {
      await saveSettings();
      const res = await fetch("/api/zatca/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "ZATCA action failed");
      addToast({ title: data?.message || "ZATCA updated", variant: "success" });
      router.refresh();
    } catch (error) {
      addToast({
        title: "ZATCA action failed",
        description: error instanceof Error ? error.message : "Review device onboarding.",
        variant: "error",
      });
    } finally {
      setZatcaAction(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax Compliance</CardTitle>
        <CardDescription>Configure tax invoice integration for this workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Compliance Mode</label>
              <Select
                value={form.taxComplianceMode}
                onValueChange={(value) => setForm({ ...form, taxComplianceMode: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="FBR">FBR (Pakistan)</SelectItem>
                  <SelectItem value="ZATCA">ZATCA (Saudi Arabia)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.taxComplianceMode === "FBR" && (
            <section className="rounded-lg border bg-muted/20 p-4">
              <h3 className="mb-3 text-sm font-semibold">FBR Setup</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="FBR Username" value={form.fbrUsername} onChange={(e) => setForm({ ...form, fbrUsername: e.target.value })} />
                <Input label="FBR Password" type="password" value={form.fbrPassword} onChange={(e) => setForm({ ...form, fbrPassword: e.target.value })} />
                <Input label="FBR POS ID" value={form.fbrPosId} onChange={(e) => setForm({ ...form, fbrPosId: e.target.value })} />
              </div>
            </section>
          )}

          {form.taxComplianceMode === "ZATCA" && (
            <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
                <div>
                  <p className="text-sm font-medium">Enable ZATCA</p>
                  <p className="text-xs text-muted-foreground">
                    Status: {formatStatus(zatcaSetting?.status)}
                  </p>
                </div>
                <Switch
                  checked={form.zatcaEnabled}
                  onCheckedChange={(checked) => setForm({ ...form, zatcaEnabled: checked })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">ZATCA Mode</label>
                  <Select
                    value={form.zatcaMode}
                    onValueChange={(value) => setForm({ ...form, zatcaMode: value })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOCAL">Local</SelectItem>
                      <SelectItem value="SIMULATION">Simulation</SelectItem>
                      <SelectItem value="PRODUCTION">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input label="Seller VAT Number" value={form.sellerVatNumber} onChange={(e) => setForm({ ...form, sellerVatNumber: e.target.value })} placeholder="15 digits" />
                <Input label="Seller Name" value={form.sellerName} onChange={(e) => setForm({ ...form, sellerName: e.target.value })} />
                <Input label="Branch Name" value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} />
                <Input label="Commercial Registration Number" value={form.crNumber} onChange={(e) => setForm({ ...form, crNumber: e.target.value })} />
                <Input label="Business Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                <Input label="Device Name" value={form.deviceName} onChange={(e) => setForm({ ...form, deviceName: e.target.value })} />
                {form.zatcaMode !== "LOCAL" && (
                  <Input label="OTP" value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value })} placeholder="OTP from FATOORA portal" />
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={Boolean(zatcaAction)} onClick={() => runZatcaAction("generate-csr")}>
                  {zatcaAction === "generate-csr" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Generate CSR
                </Button>
                {form.zatcaMode !== "LOCAL" && (
                  <Button type="button" variant="outline" disabled={Boolean(zatcaAction)} onClick={() => runZatcaAction("onboard-device")}>
                    {zatcaAction === "onboard-device" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Onboard Device
                  </Button>
                )}
                <Button type="button" variant="outline" disabled={Boolean(zatcaAction)} onClick={() => runZatcaAction("test-connection")}>
                  {zatcaAction === "test-connection" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cable className="mr-2 h-4 w-4" />}
                  Test Connection
                </Button>
              </div>

              {form.zatcaMode === "LOCAL" && (
                <p className="text-xs text-muted-foreground">
                  Local mode stores ZATCA XML, hash, and QR data without OTP or ERAD credentials.
                </p>
              )}
            </section>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Tax Compliance Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
