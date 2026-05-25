import { describe, it, expect } from "vitest";
import type { ExportColumn } from "@/lib/export-utils";

describe("ExportColumn type", () => {
  it("validates export column structure", () => {
    const columns: ExportColumn[] = [
      { key: "name", label: "Name" },
      { key: "price", label: "Price" },
    ];
    expect(columns).toHaveLength(2);
    expect(columns[0].key).toBe("name");
    expect(columns[0].label).toBe("Name");
  });
});
