import { afterEach, describe, expect, it, vi } from "vitest";
import { printThermalInvoiceViaBridge, thermalInvoicePrintUrl } from "@/features/sales/print-utils";

describe("sales print utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("builds thermal invoice print URLs", () => {
    expect(thermalInvoicePrintUrl("sale-123")).toBe("/api/invoices/sale-123?size=THERMAL_80");
  });

  it("uses company printer bridge settings when printing through the bridge", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              settings: {
                printerBridgeSettings: {
                  enabled: true,
                  bridgeUrl: "http://localhost:9123/print",
                  paperWidth: "58",
                  printerName: "Counter 1",
                  codePage: "CP864",
                  copies: 2,
                  openCashDrawer: true,
                  cutPaper: false,
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const result = await printThermalInvoiceViaBridge("sale-123");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/settings", { cache: "no-store" });
    const [, bridgeRequest] = fetchMock.mock.calls[1];
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:9123/print");
    expect(JSON.parse(String((bridgeRequest as RequestInit).body))).toMatchObject({
      saleId: "sale-123",
      paperSize: "THERMAL_58",
      width: "58mm",
      printerName: "Counter 1",
      codePage: "CP864",
      copies: 2,
      openCashDrawer: true,
      cutPaper: false,
    });
  });
});
