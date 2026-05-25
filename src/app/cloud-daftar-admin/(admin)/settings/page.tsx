"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, X, Image, FileText, Brain } from "lucide-react";

export default function AdminSettingsPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appName, setAppName] = useState("Cloud Daftar");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [assetUploading, setAssetUploading] = useState<"logo" | "favicon" | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiConfig, setAiConfig] = useState({
    enabled: true,
    provider: "local",
    model: "local-rules",
    apiKey: "",
    hasApiKey: false,
    systemPrompt:
      "You are Cloud Daftar's intelligent ERP business operating assistant. Use real ERP data, workflow states, operational risks, compliance needs, and tenant context to provide concise, practical recommendations.",
  });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/branding").then((r) => r.json()),
      fetch("/api/admin/ai-settings").then((r) => r.json()),
    ])
      .then(([branding, ai]) => {
        if (branding.success) {
          setAppName(branding.data.appName || "Cloud Daftar");
          setLogoUrl(branding.data.logoUrl || "");
          setFaviconUrl(branding.data.faviconUrl || "");
        }
        if (ai.success) {
          setAiConfig((current) => ({ ...current, ...ai.data, apiKey: "" }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleFile(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "favicon",
    setter: (v: string) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      addToast({ title: "File too large", description: "Maximum 2MB", variant: "error" });
      return;
    }
    setAssetUploading(type);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        throw new Error(d.error || "Failed to upload file");
      }

      setter(d.url);
      addToast({ title: "File uploaded", variant: "success" });
    } catch (err) {
      addToast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed to upload file",
        variant: "error",
      });
      e.currentTarget.value = "";
    } finally {
      setAssetUploading(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName, logoUrl, faviconUrl }),
      });
      const d = await res.json();
      if (d.success) {
        addToast({ title: "Branding saved", variant: "success" });
      } else throw new Error(d.error);
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAi() {
    setAiSaving(true);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...aiConfig,
          keepExistingKey: !aiConfig.apiKey && aiConfig.hasApiKey,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "Failed to save AI settings");
      setAiConfig((current) => ({ ...current, ...d.data, apiKey: "" }));
      addToast({ title: "AI settings saved", variant: "success" });
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save AI settings",
        variant: "error",
      });
    } finally {
      setAiSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">
          Customize branding and configure the background AI assistant
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aiConfig.enabled}
              onChange={(e) => setAiConfig({ ...aiConfig, enabled: e.target.checked })}
              className="rounded border-input"
            />
            Enable background AI insights for tenants
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Provider</label>
              <Select
                value={aiConfig.provider}
                onValueChange={(provider) =>
                  setAiConfig({
                    ...aiConfig,
                    provider,
                    model:
                      provider === "gemini"
                        ? "gemini-1.5-flash"
                        : provider === "openrouter"
                          ? "google/gemini-flash-1.5"
                          : "local-rules",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local rules only</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              label="Model / Agent"
              value={aiConfig.model}
              onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
              placeholder="gemini-1.5-flash"
            />
          </div>
          {aiConfig.provider !== "local" && (
            <Input
              label={aiConfig.hasApiKey ? "API Key (saved, enter only to replace)" : "API Key"}
              type="password"
              value={aiConfig.apiKey}
              onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
              placeholder={aiConfig.provider === "openrouter" ? "sk-or-..." : "Gemini API key"}
            />
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Agent Instructions</label>
            <textarea
              value={aiConfig.systemPrompt}
              onChange={(e) => setAiConfig({ ...aiConfig, systemPrompt: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button onClick={handleSaveAi} disabled={aiSaving}>
            {aiSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save AI Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            App Name
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="Cloud Daftar"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Shown in the browser tab title and invoice headers
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Upload Logo</label>
            <div className="flex items-center gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e, "logo", setLogoUrl)}
                disabled={assetUploading === "logo"}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
              />
              {assetUploading === "logo" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    setLogoUrl("");
                    if (logoInputRef.current) logoInputRef.current.value = "";
                  }}
                  title="Clear logo"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Recommended: PNG or SVG, max 2MB. Used in login screen, admin panel, and invoices.
            </p>
          </div>
          {logoUrl && (
            <div className="max-h-32 max-w-xs overflow-hidden rounded-lg border">
              <img
                src={logoUrl}
                alt="Logo preview"
                className="max-h-32 w-full bg-muted object-contain p-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Favicon
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Upload Favicon</label>
            <div className="flex items-center gap-2">
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/png,image/x-icon,image/svg+xml"
                onChange={(e) => handleFile(e, "favicon", setFaviconUrl)}
                disabled={assetUploading === "favicon"}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
              />
              {assetUploading === "favicon" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {faviconUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    setFaviconUrl("");
                    if (faviconInputRef.current) faviconInputRef.current.value = "";
                  }}
                  title="Clear favicon"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Recommended: 32x32 PNG or ICO file, max 2MB.
            </p>
          </div>
          {faviconUrl && (
            <div className="flex max-h-16 max-w-xs items-center overflow-hidden rounded-lg border bg-muted p-2">
              <img src={faviconUrl} alt="Favicon preview" className="max-h-12 w-auto" />
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Branding
      </Button>
    </div>
  );
}
