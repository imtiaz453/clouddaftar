export function thermalInvoicePrintUrl(saleId: string, opts?: { autoPrint?: boolean }) {
  const params = new URLSearchParams({ size: "THERMAL_80" });
  if (opts?.autoPrint === false) params.set("autoPrint", "false");
  return `/api/invoices/${saleId}?${params.toString()}`;
}

export function a4InvoicePrintUrl(saleId: string, opts?: { autoPrint?: boolean }) {
  const params = new URLSearchParams({ size: "A4" });
  if (opts?.autoPrint === false) params.set("autoPrint", "false");
  return `/api/invoices/${saleId}?${params.toString()}`;
}

type ThermalPrintBridgeSettings = {
  enabled?: boolean;
  bridgeUrl?: string;
  mode?: "HTTP" | "RAW_TCP";
  printerName?: string;
  paperWidth?: "58" | "80";
  codePage?: string;
  copies?: number;
  timeoutMs?: number;
  autoPrintReceipts?: boolean;
  openCashDrawer?: boolean;
  cutPaper?: boolean;
  authToken?: string;
};

const DEFAULT_THERMAL_BRIDGE_URL = "http://localhost:9123/print";

export function thermalPrintBridgeUrl(settings?: ThermalPrintBridgeSettings | null) {
  if (typeof window === "undefined") return null;
  const settingsUrl =
    settings?.bridgeUrl?.trim() || (settings?.enabled ? DEFAULT_THERMAL_BRIDGE_URL : "");
  const configured =
    settingsUrl ||
    window.localStorage.getItem("thermalPrintBridgeUrl") ||
    process.env.NEXT_PUBLIC_THERMAL_PRINT_BRIDGE_URL ||
    "";
  return configured.trim() || null;
}

async function loadThermalPrintBridgeSettings(): Promise<ThermalPrintBridgeSettings | null> {
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) return null;
    return (data.data?.settings?.printerBridgeSettings as ThermalPrintBridgeSettings) || null;
  } catch {
    return null;
  }
}

export async function printThermalInvoiceViaBridge(saleId: string) {
  const settings = await loadThermalPrintBridgeSettings();
  const bridgeUrl = thermalPrintBridgeUrl(settings);
  if (!bridgeUrl) return { ok: false, error: "Thermal print bridge is not configured" };
  if (settings && settings.enabled === false) {
    return { ok: false, error: "Thermal print bridge is disabled in settings" };
  }

  const invoiceUrl = new URL(thermalInvoicePrintUrl(saleId), window.location.origin).toString();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), settings?.timeoutMs || 10000);

  try {
    const res = await fetch(bridgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings?.authToken ? { Authorization: `Bearer ${settings.authToken}` } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({
        type: "thermal-invoice",
        saleId,
        url: invoiceUrl,
        paperSize: settings?.paperWidth === "58" ? "THERMAL_58" : "THERMAL_80",
        width: `${settings?.paperWidth || "80"}mm`,
        mode: settings?.mode || "HTTP",
        printerName: settings?.printerName || "Default thermal printer",
        codePage: settings?.codePage || "CP437",
        copies: settings?.copies || 1,
        openCashDrawer: settings?.openCashDrawer ?? false,
        cutPaper: settings?.cutPaper ?? true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || `Thermal print bridge returned ${res.status}` };
    }

    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? "Thermal print bridge request timed out"
          : error instanceof Error
            ? error.message
            : "Thermal print bridge request failed",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export function openThermalInvoicePrintWindow() {
  if (typeof window === "undefined") return null;
  return window.open("about:blank", "_blank", "width=420,height=720");
}

export function openA4InvoicePrintWindow() {
  if (typeof window === "undefined") return null;
  return window.open("about:blank", "_blank", "width=900,height=700");
}

export function printThermalInvoice(saleId: string, printWindow: Window | null) {
  const url = thermalInvoicePrintUrl(saleId);
  if (printWindow) {
    printWindow.location.href = url;
    printWindow.focus();
    return;
  }
  window.open(url, "_blank", "width=420,height=720");
}

export function printA4Invoice(saleId: string, printWindow: Window | null) {
  const url = a4InvoicePrintUrl(saleId);
  if (printWindow) {
    printWindow.location.href = url;
    printWindow.focus();
    return;
  }
  window.open(url, "_blank", "width=900,height=700");
}
