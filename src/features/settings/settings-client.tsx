"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Save, Upload, Image as ImageIcon, FileText, Printer } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type {
  Company,
  CompanySettings,
  PaymentMethod,
  ThemeSettings,
  ZatcaSetting,
  ZatcaEgsUnit,
} from "@prisma/client";
import { TEMPLATE_DEFINITIONS } from "@/lib/template-registry";
import { getLocalityPreset } from "@/lib/locality";
import { TaxComplianceTab } from "./tax-compliance-tab";
import { TemplatesClient } from "./templates/templates-client";
import { StoresClient } from "./stores/stores-client";

interface SettingsClientProps {
  companyData: Company & {
    settings?: CompanySettings | null;
    theme?: ThemeSettings | null;
    zatcaEgsUnits?: ZatcaEgsUnit[];
    zatcaSetting?: ZatcaSetting | null;
  };
  templates?: any[];
  stores?: any[];
  branches?: any[];
  employees?: any[];
  capabilities: {
    canManageCompany: boolean;
    canManageSettings: boolean;
    canViewTemplates: boolean;
    canViewStores: boolean;
    canManageStores: boolean;
    canManageTemplates: boolean;
    canManageBranding: boolean;
    canManageTax: boolean;
  };
}

type PrinterBridgeSettings = {
  enabled: boolean;
  bridgeUrl: string;
  mode: "HTTP" | "RAW_TCP";
  printerName: string;
  paperWidth: "58" | "80";
  codePage: string;
  copies: number;
  timeoutMs: number;
  autoPrintReceipts: boolean;
  openCashDrawer: boolean;
  cutPaper: boolean;
  authToken: string;
};

const defaultPrinterBridgeSettings: PrinterBridgeSettings = {
  enabled: false,
  bridgeUrl: "http://localhost:9123/print",
  mode: "HTTP",
  printerName: "Default thermal printer",
  paperWidth: "80",
  codePage: "CP437",
  copies: 1,
  timeoutMs: 10000,
  autoPrintReceipts: true,
  openCashDrawer: false,
  cutPaper: true,
  authToken: "",
};

export function SettingsClient({
  companyData,
  templates = [],
  stores = [],
  branches = [],
  employees = [],
  capabilities,
}: SettingsClientProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const rawSearchParams = useSearchParams();
  const searchParams = useMemo(() => rawSearchParams ?? new URLSearchParams(), [rawSearchParams]);
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const accessibleTabs = useMemo(
    () => [
      ...(capabilities.canManageCompany ? ["general"] : []),
      ...(capabilities.canManageSettings ? ["business", "preferences", "pos-printer"] : []),
      ...(capabilities.canViewStores ? ["stores"] : []),
      ...(capabilities.canViewTemplates ? ["templates"] : []),
      ...(capabilities.canManageBranding ? ["theme"] : []),
      ...(capabilities.canManageTax ? ["tax-compliance"] : []),
    ],
    [capabilities],
  );
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return accessibleTabs.includes(tab || "") ? tab! : accessibleTabs[0] || "general";
  });
  const savedPrinterBridgeSettings = {
    ...defaultPrinterBridgeSettings,
    ...(((companyData.settings as any)?.printerBridgeSettings ||
      {}) as Partial<PrinterBridgeSettings>),
  };

  const [form, setForm] = useState({
    name: companyData.name || "",
    phone: companyData.phone || "",
    email: companyData.email || "",
    website: companyData.website || "",
    address: companyData.address || "",
    city: companyData.city || "",
    state: companyData.state || "",
    zipCode: companyData.zipCode || "",
    country: companyData.country || "PK",
    taxId: companyData.taxId || "",
    taxName: companyData.taxName || "",
    taxRate: Number(companyData.taxRate) || 0,
    currency: companyData.currency || "PKR",
    currencySymbol: companyData.currencySymbol || "Rs",
    timezone: companyData.timezone || "Asia/Karachi",
    dateFormat: companyData.dateFormat || "DD/MM/YYYY",
    fiscalYearStart: companyData.fiscalYearStart || "01-01",
    logo: companyData.logo || "",
  });

  const [settingsForm, setSettingsForm] = useState({
    invoicePrefix: companyData.settings?.invoicePrefix || "INV-",
    salesOrderPrefix: companyData.settings?.salesOrderPrefix || "SORD-",
    proformaInvoicePrefix: (companyData.settings as any)?.proformaInvoicePrefix || "PI-",
    quotationPrefix: companyData.settings?.quotationPrefix || "QUOT-",
    purchaseOrderPrefix: companyData.settings?.purchaseOrderPrefix || "PO-",
    invoiceSuffix: companyData.settings?.invoiceSuffix || "",
    invoiceNumberLength: companyData.settings?.invoiceNumberLength || 5,
    defaultInvoiceTemplate: companyData.settings?.defaultInvoiceTemplate || "",
    defaultThermalInvoiceTemplate:
      (companyData.settings as any)?.defaultThermalInvoiceTemplate || "",
    defaultQuotationTemplate: companyData.settings?.defaultQuotationTemplate || "",
    defaultPurchaseOrderTemplate: (companyData.settings as any)?.defaultPurchaseOrderTemplate || "",
    lowStockThreshold: companyData.settings?.lowStockThreshold || 10,
    defaultPaymentMethod: (companyData.settings?.defaultPaymentMethod || "CASH") as PaymentMethod,
    defaultTaxRate: Number(companyData.settings?.defaultTaxRate) || 0,
    skuPrefix: companyData.settings?.skuPrefix || "CD",
    autoGenerateSKU: companyData.settings?.autoGenerateSKU ?? true,
    enableBarcodeScanning: companyData.settings?.enableBarcodeScanning ?? true,
    enableNegativeStock: companyData.settings?.enableNegativeStock ?? false,
    enableExpiryTracking: companyData.settings?.enableExpiryTracking ?? true,
    currencyPosition: companyData.settings?.currencyPosition || "left",
    thousandSeparator: companyData.settings?.thousandSeparator || ",",
    decimalSeparator: companyData.settings?.decimalSeparator || ".",
    decimalPlaces: companyData.settings?.decimalPlaces || 2,
    language: companyData.settings?.language || "en",
    printerBridgeSettings: savedPrinterBridgeSettings,
  });

  const [themeForm, setThemeForm] = useState({
    sidebarColor: companyData.theme?.sidebarColor || "brand",
    sidebarStyle: companyData.theme?.sidebarStyle || "minimal",
    primaryColor: companyData.theme?.primaryColor || "plum",
    accentColor: companyData.theme?.accentColor || "teal",
    fontFamily: companyData.theme?.fontFamily || "inter",
    borderRadius: companyData.theme?.borderRadius || "small",
    layoutDensity: companyData.theme?.layoutDensity || "comfortable",
    isDarkMode: companyData.theme?.isDarkMode ?? false,
  });

  const savedTheme = useRef(themeForm);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && accessibleTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [accessibleTabs, searchParams]);

  useEffect(() => {
    if (!accessibleTabs.includes(activeTab)) setActiveTab(accessibleTabs[0] || "general");
  }, [accessibleTabs, activeTab]);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    router.replace(tab === "general" ? pathname : `${pathname}?tab=${tab}`, { scroll: false });
  }

  function updatePrinterBridgeField<K extends keyof PrinterBridgeSettings>(
    field: K,
    value: PrinterBridgeSettings[K],
  ) {
    setSettingsForm((prev) => ({
      ...prev,
      printerBridgeSettings: {
        ...prev.printerBridgeSettings,
        [field]: value,
      },
    }));
  }

  function updateThemeField<K extends keyof typeof themeForm>(
    field: K,
    value: (typeof themeForm)[K],
  ) {
    const updated = { ...themeForm, [field]: value };
    setThemeForm(updated);
    window.dispatchEvent(new CustomEvent("theme-preview", { detail: updated }));
  }

  function emitCurrencySettings() {
    window.dispatchEvent(
      new CustomEvent("currency-saved", {
        detail: {
          country: form.country,
          currency: form.currency,
          currencySymbol: form.currencySymbol,
          taxName: form.country === "SA" ? "VAT" : form.taxName,
          taxComplianceMode: form.country === "SA" ? "ZATCA" : undefined,
          currencyPosition: settingsForm.currencyPosition,
          thousandSeparator: settingsForm.thousandSeparator,
          decimalSeparator: settingsForm.decimalSeparator,
          decimalPlaces: settingsForm.decimalPlaces,
        },
      }),
    );
  }

  function updateCountry(country: string) {
    setForm((prev) => {
      if (country !== "SA" && country !== "PK") return { ...prev, country };
      const preset = getLocalityPreset(country);
      return {
        ...prev,
        country: preset.country,
        currency: preset.currency,
        currencySymbol: preset.currencySymbol,
        timezone: preset.timezone,
        taxName: preset.taxName,
        taxRate: preset.taxRate,
      };
    });
  }

  function updateCurrency(currency: string) {
    const symbolByCurrency: Record<string, string> = {
      PKR: "Rs",
      USD: "$",
      AED: "AED",
      SAR: "SAR",
      GBP: "GBP",
    };
    setForm((prev) => ({
      ...prev,
      currency,
      currencySymbol: symbolByCurrency[currency] || prev.currencySymbol,
    }));
  }

  // Revert live preview on unmount (SPA navigation)
  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent("theme-saved", { detail: savedTheme.current }));
    };
  }, []);

  // Revert live preview on tab close
  useEffect(() => {
    function handleBeforeUnload() {
      window.dispatchEvent(new CustomEvent("theme-saved", { detail: savedTheme.current }));
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save");
      }
      addToast({ title: "Settings saved", variant: "success" });
      emitCurrencySettings();
      router.refresh();
    } catch (err) {
      addToast({
        title: "Error saving settings",
        description: err instanceof Error ? err.message : "Please check the entered values.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _type: "settings", ...settingsForm }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save");
      }
      addToast({ title: "Preferences saved", variant: "success" });
      emitCurrencySettings();
      router.refresh();
    } catch (err) {
      addToast({
        title: "Error saving preferences",
        description: err instanceof Error ? err.message : "Please check the entered values.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTheme(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _type: "theme", ...themeForm }),
      });
      if (!res.ok) throw new Error("Failed to save");
      savedTheme.current = themeForm;
      addToast({ title: "Theme saved", variant: "success" });
      window.dispatchEvent(new CustomEvent("theme-saved", { detail: themeForm }));
      router.refresh();
    } catch {
      addToast({ title: "Error saving theme", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const handleLogoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadingLogo(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "companyLogo");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || "Upload failed");
        }

        const result = await uploadRes.json();
        if (result.url) {
          setForm((prev) => ({ ...prev, logo: result.url }));
          window.dispatchEvent(new CustomEvent("logo-updated", { detail: { url: result.url } }));
          addToast({ title: "Logo updated", variant: "success" });
          router.refresh();
        }
      } catch (err) {
        addToast({
          title: err instanceof Error ? err.message : "Error uploading logo",
          variant: "error",
        });
      } finally {
        setUploadingLogo(false);
      }
    },
    [addToast, router],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your business settings and preferences" />

      {accessibleTabs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You do not have permission to view any settings sections.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-5">
          <TabsList className="w-full justify-start">
            {capabilities.canManageCompany && <TabsTrigger value="general">General</TabsTrigger>}
            {capabilities.canManageSettings && <TabsTrigger value="business">Business</TabsTrigger>}
            {capabilities.canManageSettings && (
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            )}
            {capabilities.canManageSettings && (
              <TabsTrigger value="pos-printer">POS Printer</TabsTrigger>
            )}
            {capabilities.canViewStores && <TabsTrigger value="stores">Stores</TabsTrigger>}
            {capabilities.canViewTemplates && (
              <TabsTrigger value="templates">Templates</TabsTrigger>
            )}
            {capabilities.canManageBranding && <TabsTrigger value="theme">Theme</TabsTrigger>}
            {capabilities.canManageTax && (
              <TabsTrigger value="tax-compliance">Tax Compliance</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="general" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Company Logo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted">
                    {form.logo ? (
                      <img
                        src={form.logo}
                        alt="Logo"
                        className="h-full w-full rounded-lg object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <label className="relative cursor-pointer">
                      <Button variant="outline" type="button" disabled={uploadingLogo} asChild>
                        <span>
                          {uploadingLogo ? (
                            <LoadingSpinner size={4} className="mr-2" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          {uploadingLogo ? "Uploading..." : "Upload Logo"}
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">PNG, JPG up to 1MB</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>General Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Company Name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                    <Input
                      label="Website"
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                    />
                    <Input
                      label="Phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <Input
                      label={form.country === "SA" ? "VAT Name" : "Tax Name (e.g. GST/VAT)"}
                      value={form.taxName}
                      onChange={(e) => setForm({ ...form, taxName: e.target.value })}
                    />
                    <Input
                      label={form.country === "SA" ? "VAT Registration Number" : "Tax ID / NTN"}
                      value={form.taxId}
                      onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                    />
                    <Input
                      label="City"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                    <Input
                      label="State"
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                    />
                    <Input
                      label="Zip Code"
                      value={form.zipCode}
                      onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Country</label>
                      <Select value={form.country} onValueChange={updateCountry}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PK">Pakistan</SelectItem>
                          <SelectItem value="AE">UAE</SelectItem>
                          <SelectItem value="SA">Saudi Arabia</SelectItem>
                          <SelectItem value="US">United States</SelectItem>
                          <SelectItem value="GB">United Kingdom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      label="Address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving && <LoadingSpinner size={4} className="mr-2" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {form.country === "SA" ? "Business & VAT Settings" : "Business & Tax Settings"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label={`${form.country === "SA" ? "VAT" : "Tax"} Rate (%)`}
                      type="number"
                      step="0.01"
                      value={form.taxRate}
                      onChange={(e) =>
                        setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })
                      }
                    />
                    <Input
                      label="Fiscal Year Start (MM-DD)"
                      value={form.fiscalYearStart}
                      onChange={(e) => setForm({ ...form, fiscalYearStart: e.target.value })}
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Currency</label>
                      <Select value={form.currency} onValueChange={updateCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                          <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      label="Currency Symbol"
                      value={form.currencySymbol}
                      onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Timezone</label>
                      <Select
                        value={form.timezone}
                        onValueChange={(v) => setForm({ ...form, timezone: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Asia/Karachi">Asia/Karachi (PKT)</SelectItem>
                          <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                          <SelectItem value="Asia/Riyadh">Asia/Riyadh</SelectItem>
                          <SelectItem value="America/New_York">America/New_York</SelectItem>
                          <SelectItem value="Europe/London">Europe/London</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Date Format</label>
                      <Select
                        value={form.dateFormat}
                        onValueChange={(v) => setForm({ ...form, dateFormat: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving && <LoadingSpinner size={4} className="mr-2" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Business Settings
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Currency Formatting</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Currency Position</label>
                      <Select
                        value={settingsForm.currencyPosition}
                        onValueChange={(v) =>
                          setSettingsForm({ ...settingsForm, currencyPosition: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left (Rs 1,000)</SelectItem>
                          <SelectItem value="right">Right (1,000 Rs)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Thousand Separator</label>
                      <Select
                        value={settingsForm.thousandSeparator}
                        onValueChange={(v) =>
                          setSettingsForm({ ...settingsForm, thousandSeparator: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=",">Comma (1,000)</SelectItem>
                          <SelectItem value=".">Dot (1.000)</SelectItem>
                          <SelectItem value=" ">Space (1 000)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Decimal Separator</label>
                      <Select
                        value={settingsForm.decimalSeparator}
                        onValueChange={(v) =>
                          setSettingsForm({ ...settingsForm, decimalSeparator: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=".">Dot (0.00)</SelectItem>
                          <SelectItem value=",">Comma (0,00)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      label="Decimal Places"
                      type="number"
                      min="0"
                      max="6"
                      value={settingsForm.decimalPlaces}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          decimalPlaces: parseInt(e.target.value) || 2,
                        })
                      }
                    />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving && <LoadingSpinner size={4} className="mr-2" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Formatting
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Document numbering</CardTitle>
                <CardDescription>
                  Sequential numbers per document type. Prefixes apply to new documents only; change
                  prefixes in Settings before going live.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Invoice prefix (completed sales)"
                      value={settingsForm.invoicePrefix}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, invoicePrefix: e.target.value })
                      }
                      placeholder="INV-"
                    />
                    <Input
                      label="Sales order prefix (draft / confirmed)"
                      value={settingsForm.salesOrderPrefix}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, salesOrderPrefix: e.target.value })
                      }
                      placeholder="SORD-"
                    />
                    <Input
                      label="Proforma invoice prefix"
                      value={settingsForm.proformaInvoicePrefix}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, proformaInvoicePrefix: e.target.value })
                      }
                      placeholder="PI-"
                    />
                    <Input
                      label="Quotation prefix"
                      value={settingsForm.quotationPrefix}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, quotationPrefix: e.target.value })
                      }
                      placeholder="QUOT-"
                    />
                    <Input
                      label="Purchase order prefix"
                      value={settingsForm.purchaseOrderPrefix}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, purchaseOrderPrefix: e.target.value })
                      }
                      placeholder="PO-"
                    />
                    <Input
                      label="Number suffix (optional, all types)"
                      value={settingsForm.invoiceSuffix}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, invoiceSuffix: e.target.value })
                      }
                    />
                    <Input
                      label="Numeric length (digits)"
                      type="number"
                      min="3"
                      max="10"
                      value={settingsForm.invoiceNumberLength}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          invoiceNumberLength: parseInt(e.target.value) || 5,
                        })
                      }
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        Default Invoice Template
                      </label>
                      <Select
                        value={settingsForm.defaultInvoiceTemplate}
                        onValueChange={(v) =>
                          setSettingsForm({ ...settingsForm, defaultInvoiceTemplate: v })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_DEFINITIONS.filter((t) => t.type === "invoice").map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                {t.name} (
                                {t.paperSize === "A4"
                                  ? "A4"
                                  : t.paperSize === "THERMAL_80"
                                    ? "80mm"
                                    : "58mm"}
                                )
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        Default POS / Thermal Invoice Template
                      </label>
                      <Select
                        value={settingsForm.defaultThermalInvoiceTemplate}
                        onValueChange={(v) =>
                          setSettingsForm({ ...settingsForm, defaultThermalInvoiceTemplate: v })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a thermal template" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_DEFINITIONS.filter(
                            (t) => t.type === "invoice" && t.paperSize !== "A4",
                          ).map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                {t.name} ({t.paperSize === "THERMAL_80" ? "80mm" : "58mm"})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        Default Quotation Template
                      </label>
                      <Select
                        value={settingsForm.defaultQuotationTemplate}
                        onValueChange={(v) =>
                          setSettingsForm({ ...settingsForm, defaultQuotationTemplate: v })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_DEFINITIONS.filter((t) => t.type === "quotation").map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                {t.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        Default Purchase Order Template
                      </label>
                      <Select
                        value={settingsForm.defaultPurchaseOrderTemplate}
                        onValueChange={(v) =>
                          setSettingsForm({ ...settingsForm, defaultPurchaseOrderTemplate: v })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a purchase order template" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_DEFINITIONS.filter((t) => t.type === "purchase_order").map(
                            (t) => (
                              <SelectItem key={t.id} value={t.id}>
                                <span className="flex items-center gap-2">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  {t.name}
                                </span>
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving && <LoadingSpinner size={4} className="mr-2" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Invoice Settings
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory & Product Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Low Stock Threshold"
                      type="number"
                      value={settingsForm.lowStockThreshold}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          lowStockThreshold: parseInt(e.target.value) || 10,
                        })
                      }
                    />
                    <Input
                      label="SKU Prefix"
                      value={settingsForm.skuPrefix}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, skuPrefix: e.target.value })
                      }
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        Default Payment Method
                      </label>
                      <Select
                        value={settingsForm.defaultPaymentMethod}
                        onValueChange={(v) =>
                          setSettingsForm({
                            ...settingsForm,
                            defaultPaymentMethod: v as PaymentMethod,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="CARD">Card</SelectItem>
                          <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                          <SelectItem value="MOBILE_PAYMENT">Mobile Payment</SelectItem>
                          <SelectItem value="CHEQUE">Cheque</SelectItem>
                          <SelectItem value="EASYPAISA">Easypaisa</SelectItem>
                          <SelectItem value="JAZZCASH">JazzCash</SelectItem>
                          <SelectItem value="ONLINE_TRANSFER">Online Transfer</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      label={`Default ${form.country === "SA" ? "VAT" : "Tax"} Rate (%)`}
                      type="number"
                      step="0.01"
                      value={settingsForm.defaultTaxRate}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          defaultTaxRate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Language</label>
                      <Select
                        value={settingsForm.language}
                        onValueChange={(v) => setSettingsForm({ ...settingsForm, language: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="ur">Urdu</SelectItem>
                          <SelectItem value="ar">Arabic</SelectItem>
                          <SelectItem value="dual">English + Arabic documents</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Auto-generate SKU</p>
                        <p className="text-xs text-muted-foreground">
                          Generate SKUs automatically for new products
                        </p>
                      </div>
                      <Switch
                        checked={settingsForm.autoGenerateSKU}
                        onCheckedChange={(v) =>
                          setSettingsForm({ ...settingsForm, autoGenerateSKU: v })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Barcode Scanning</p>
                        <p className="text-xs text-muted-foreground">
                          Enable barcode scanning in POS
                        </p>
                      </div>
                      <Switch
                        checked={settingsForm.enableBarcodeScanning}
                        onCheckedChange={(v) =>
                          setSettingsForm({ ...settingsForm, enableBarcodeScanning: v })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Negative Stock</p>
                        <p className="text-xs text-muted-foreground">
                          Allow selling below zero stock
                        </p>
                      </div>
                      <Switch
                        checked={settingsForm.enableNegativeStock}
                        onCheckedChange={(v) =>
                          setSettingsForm({ ...settingsForm, enableNegativeStock: v })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Expiry Tracking</p>
                        <p className="text-xs text-muted-foreground">Track product expiry dates</p>
                      </div>
                      <Switch
                        checked={settingsForm.enableExpiryTracking}
                        onCheckedChange={(v) =>
                          setSettingsForm({ ...settingsForm, enableExpiryTracking: v })
                        }
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving && <LoadingSpinner size={4} className="mr-2" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Preferences
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pos-printer" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-muted-foreground" />
                  POS Thermal Printer Bridge
                </CardTitle>
                <CardDescription>
                  Configure the local bridge that receives POS receipts and forwards them to a
                  thermal printer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Enable printer bridge</p>
                      <p className="text-xs text-muted-foreground">
                        Send POS thermal receipts through the configured local bridge.
                      </p>
                    </div>
                    <Switch
                      checked={settingsForm.printerBridgeSettings.enabled}
                      onCheckedChange={(v) => updatePrinterBridgeField("enabled", v)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Bridge URL"
                      value={settingsForm.printerBridgeSettings.bridgeUrl}
                      onChange={(e) => updatePrinterBridgeField("bridgeUrl", e.target.value)}
                      placeholder="http://localhost:9123/print"
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Bridge Mode</label>
                      <Select
                        value={settingsForm.printerBridgeSettings.mode}
                        onValueChange={(v) =>
                          updatePrinterBridgeField("mode", v as PrinterBridgeSettings["mode"])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HTTP">HTTP endpoint</SelectItem>
                          <SelectItem value="RAW_TCP">Raw TCP / ESC-POS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      label="Printer Name"
                      value={settingsForm.printerBridgeSettings.printerName}
                      onChange={(e) => updatePrinterBridgeField("printerName", e.target.value)}
                      placeholder="Counter 1"
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Paper Width</label>
                      <Select
                        value={settingsForm.printerBridgeSettings.paperWidth}
                        onValueChange={(v) =>
                          updatePrinterBridgeField(
                            "paperWidth",
                            v as PrinterBridgeSettings["paperWidth"],
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="80">80mm</SelectItem>
                          <SelectItem value="58">58mm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      label="Code Page"
                      value={settingsForm.printerBridgeSettings.codePage}
                      onChange={(e) => updatePrinterBridgeField("codePage", e.target.value)}
                      placeholder="CP437"
                    />
                    <Input
                      label="Copies"
                      type="number"
                      min="1"
                      max="5"
                      value={settingsForm.printerBridgeSettings.copies}
                      onChange={(e) =>
                        updatePrinterBridgeField("copies", parseInt(e.target.value) || 1)
                      }
                    />
                    <Input
                      label="Timeout (ms)"
                      type="number"
                      min="1000"
                      max="60000"
                      step="500"
                      value={settingsForm.printerBridgeSettings.timeoutMs}
                      onChange={(e) =>
                        updatePrinterBridgeField("timeoutMs", parseInt(e.target.value) || 10000)
                      }
                    />
                    <Input
                      label="Auth Token"
                      type="password"
                      value={settingsForm.printerBridgeSettings.authToken}
                      onChange={(e) => updatePrinterBridgeField("authToken", e.target.value)}
                      placeholder="Optional"
                    />
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Auto print receipts</p>
                        <p className="text-xs text-muted-foreground">Print after POS checkout.</p>
                      </div>
                      <Switch
                        checked={settingsForm.printerBridgeSettings.autoPrintReceipts}
                        onCheckedChange={(v) => updatePrinterBridgeField("autoPrintReceipts", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Open cash drawer</p>
                        <p className="text-xs text-muted-foreground">Send drawer pulse command.</p>
                      </div>
                      <Switch
                        checked={settingsForm.printerBridgeSettings.openCashDrawer}
                        onCheckedChange={(v) => updatePrinterBridgeField("openCashDrawer", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Cut paper</p>
                        <p className="text-xs text-muted-foreground">
                          Send cut command at the end.
                        </p>
                      </div>
                      <Switch
                        checked={settingsForm.printerBridgeSettings.cutPaper}
                        onCheckedChange={(v) => updatePrinterBridgeField("cutPaper", v)}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={saving}>
                    {saving && <LoadingSpinner size={4} className="mr-2" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Printer Settings
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stores" className="mt-4 space-y-4">
            <StoresClient
              stores={stores}
              branches={branches}
              employees={employees}
              canManage={capabilities.canManageStores}
            />
          </TabsContent>

          <TabsContent value="templates" className="mt-4 space-y-4">
            <TemplatesClient
              templates={templates}
              canManage={capabilities.canManageTemplates}
              companySettings={{
                defaultInvoiceTemplate: companyData.settings?.defaultInvoiceTemplate,
                defaultThermalInvoiceTemplate: (companyData.settings as any)
                  ?.defaultThermalInvoiceTemplate,
                defaultQuotationTemplate: companyData.settings?.defaultQuotationTemplate,
                defaultPurchaseOrderTemplate: (companyData.settings as any)
                  ?.defaultPurchaseOrderTemplate,
              }}
            />
          </TabsContent>
          <TabsContent value="theme" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Theme Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveTheme} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Primary Color</label>
                      <Select
                        value={themeForm.primaryColor}
                        onValueChange={(v) => updateThemeField("primaryColor", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blue">Blue</SelectItem>
                          <SelectItem value="indigo">Indigo</SelectItem>
                          <SelectItem value="violet">Violet</SelectItem>
                          <SelectItem value="green">Green</SelectItem>
                          <SelectItem value="emerald">Emerald</SelectItem>
                          <SelectItem value="teal">Teal</SelectItem>
                          <SelectItem value="cyan">Cyan</SelectItem>
                          <SelectItem value="red">Red</SelectItem>
                          <SelectItem value="orange">Orange</SelectItem>
                          <SelectItem value="amber">Amber</SelectItem>
                          <SelectItem value="rose">Rose</SelectItem>
                          <SelectItem value="slate">Slate</SelectItem>
                          <SelectItem value="plum">Plum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Accent Color</label>
                      <Select
                        value={themeForm.accentColor || "none"}
                        onValueChange={(v) =>
                          updateThemeField("accentColor", v === "none" ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="blue">Blue</SelectItem>
                          <SelectItem value="indigo">Indigo</SelectItem>
                          <SelectItem value="violet">Violet</SelectItem>
                          <SelectItem value="green">Green</SelectItem>
                          <SelectItem value="emerald">Emerald</SelectItem>
                          <SelectItem value="teal">Teal</SelectItem>
                          <SelectItem value="cyan">Cyan</SelectItem>
                          <SelectItem value="red">Red</SelectItem>
                          <SelectItem value="orange">Orange</SelectItem>
                          <SelectItem value="amber">Amber</SelectItem>
                          <SelectItem value="rose">Rose</SelectItem>
                          <SelectItem value="plum">Plum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Sidebar Color</label>
                      <Select
                        value={themeForm.sidebarColor}
                        onValueChange={(v) => updateThemeField("sidebarColor", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="white">White</SelectItem>
                          <SelectItem value="light">Light Gray</SelectItem>
                          <SelectItem value="slate">Slate</SelectItem>
                          <SelectItem value="zinc">Zinc</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="blue">Blue</SelectItem>
                          <SelectItem value="indigo">Indigo</SelectItem>
                          <SelectItem value="violet">Violet</SelectItem>
                          <SelectItem value="green">Green</SelectItem>
                          <SelectItem value="emerald">Emerald</SelectItem>
                          <SelectItem value="teal">Teal</SelectItem>
                          <SelectItem value="cyan">Cyan</SelectItem>
                          <SelectItem value="red">Red</SelectItem>
                          <SelectItem value="orange">Orange</SelectItem>
                          <SelectItem value="amber">Amber</SelectItem>
                          <SelectItem value="rose">Rose</SelectItem>
                          <SelectItem value="plum">Plum</SelectItem>
                          <SelectItem value="brand">CloudDaftar Purple</SelectItem>
                          <SelectItem value="midnight">Midnight Blue</SelectItem>
                          <SelectItem value="charcoal">Charcoal</SelectItem>
                          <SelectItem value="beige">Beige</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Theme Style</label>
                      <Select
                        value={themeForm.sidebarStyle}
                        onValueChange={(v) => updateThemeField("sidebarStyle", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gradient">Gradient</SelectItem>
                          <SelectItem value="solid">Solid</SelectItem>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="glass">Glass 3D</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Font Family</label>
                      <Select
                        value={themeForm.fontFamily}
                        onValueChange={(v) => updateThemeField("fontFamily", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inter">Inter</SelectItem>
                          <SelectItem value="system">System UI</SelectItem>
                          <SelectItem value="mono">Monospace</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Border Radius</label>
                      <Select
                        value={themeForm.borderRadius}
                        onValueChange={(v) => updateThemeField("borderRadius", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="small">Small</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="large">Large</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Layout Density</label>
                      <Select
                        value={themeForm.layoutDensity}
                        onValueChange={(v) => updateThemeField("layoutDensity", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compact">Compact</SelectItem>
                          <SelectItem value="comfortable">Comfortable</SelectItem>
                          <SelectItem value="spacious">Spacious</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Dark Mode Default</p>
                      <p className="text-xs text-muted-foreground">
                        Set dark mode as default theme
                      </p>
                    </div>
                    <Switch
                      checked={themeForm.isDarkMode}
                      onCheckedChange={(v) => updateThemeField("isDarkMode", v)}
                    />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving && <LoadingSpinner size={4} className="mr-2" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Theme
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tax-compliance" className="mt-4">
            <TaxComplianceTab
              settings={companyData.settings}
              egsUnits={companyData.zatcaEgsUnits}
              zatcaSetting={companyData.zatcaSetting}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
