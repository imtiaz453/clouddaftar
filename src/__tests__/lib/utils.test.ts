import { afterEach, describe, it, expect } from "vitest";
import { cn, formatDate, formatCurrency, generateSku, generateInvoiceNumber, slugify, truncate, parseError } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });
});

describe("formatDate", () => {
  it("formats date in DD/MM/YYYY by default", () => {
    const result = formatDate("2024-03-15");
    expect(result).toBe("15/03/2024");
  });

  it("formats date in MM/DD/YYYY", () => {
    const result = formatDate("2024-03-15", "MM/DD/YYYY");
    expect(result).toBe("03/15/2024");
  });

  it("formats date in YYYY-MM-DD", () => {
    const result = formatDate("2024-03-15", "YYYY-MM-DD");
    expect(result).toBe("2024-03-15");
  });

  it("handles Date object", () => {
    const result = formatDate(new Date(2024, 2, 15));
    expect(result).toBe("15/03/2024");
  });
});

describe("formatCurrency", () => {
  afterEach(() => {
    delete document.documentElement.dataset.currencySymbol;
    delete document.documentElement.dataset.currencyPosition;
    delete document.documentElement.dataset.thousandSeparator;
    delete document.documentElement.dataset.decimalSeparator;
    delete document.documentElement.dataset.decimalPlaces;
  });

  it("formats with default currency", () => {
    expect(formatCurrency(1234.5)).toBe("Rs 1,234.50");
  });

  it("formats with custom symbol", () => {
    expect(formatCurrency(100, "USD", "$")).toBe("$ 100.00");
  });

  it("formats with symbol on right", () => {
    expect(formatCurrency(50, "PKR", "Rs", "right")).toBe("50.00 Rs");
  });

  it("handles string input", () => {
    expect(formatCurrency("99.99")).toBe("Rs 99.99");
  });

  it("uses company currency settings from the page", () => {
    document.documentElement.dataset.currencySymbol = "SAR";
    document.documentElement.dataset.currencyPosition = "left";
    document.documentElement.dataset.thousandSeparator = ",";
    document.documentElement.dataset.decimalSeparator = ".";
    document.documentElement.dataset.decimalPlaces = "2";

    expect(formatCurrency(1234.5)).toBe("SAR 1,234.50");
  });
});

describe("generateSku", () => {
  it("generates SKU with default prefix", () => {
    const sku = generateSku();
    expect(sku).toMatch(/^CD-[A-Z0-9]{6}$/);
  });

  it("generates SKU with custom prefix", () => {
    const sku = generateSku("STORE");
    expect(sku).toMatch(/^STORE-[A-Z0-9]{6}$/);
  });

  it("generates unique SKUs", () => {
    const skus = new Set(Array.from({ length: 100 }, () => generateSku()));
    expect(skus.size).toBe(100);
  });
});

describe("generateInvoiceNumber", () => {
  it("generates with default prefix", () => {
    const inv = generateInvoiceNumber();
    expect(inv).toMatch(/^INV-\d{5}$/);
  });

  it("generates with custom prefix and suffix", () => {
    const inv = generateInvoiceNumber("PO-", 4, "-A");
    expect(inv).toMatch(/^PO-\d{4}-A$/);
  });
});

describe("slugify", () => {
  it("converts text to slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("Product @# $123")).toBe("product-123");
  });

  it("trims whitespace", () => {
    expect(slugify("  test  ")).toBe("test");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("a---b")).toBe("a-b");
  });
});

describe("truncate", () => {
  it("returns full string if within length", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates and adds ellipsis", () => {
    expect(truncate("hello world", 5)).toBe("hello...");
  });
});

describe("parseError", () => {
  it("parses Error instance", () => {
    expect(parseError(new Error("boom"))).toBe("boom");
  });

  it("parses string error", () => {
    expect(parseError("something broke")).toBe("something broke");
  });

  it("returns fallback for unknown", () => {
    expect(parseError(42)).toBe("An unexpected error occurred");
  });
});
