import { describe, expect, it } from "vitest";
import {
  applyScannedBarcode,
  type LineItem,
  type ProductOption,
} from "@/components/shared/line-item-editor";

function emptyRow(overrides?: Partial<LineItem>): LineItem {
  return {
    id: "row-1",
    productId: "",
    productName: "",
    sku: "",
    barcode: "",
    unit: "",
    quantity: 1,
    price: 0,
    discount: 0,
    tax: 0,
    stock: 0,
    ...overrides,
  };
}

const products: ProductOption[] = [
  {
    id: "product-1",
    name: "Demo Item",
    sku: "SKU-1",
    barcode: "8901234567890",
    sellingPrice: "125.50",
    tax: 0,
    unit: "pcs",
    stock: 8,
    isActive: true,
    isService: false,
  },
];

describe("applyScannedBarcode", () => {
  it("adds a matched barcode into the first empty invoice row", () => {
    const result = applyScannedBarcode([emptyRow()], products, " 8901234567890 ", 17);

    expect(result.found).toBe(true);
    expect(result.items).toEqual([
      expect.objectContaining({
        productId: "product-1",
        productName: "Demo Item",
        barcode: "8901234567890",
        quantity: 1,
        price: 125.5,
        tax: 17,
      }),
    ]);
  });

  it("increments quantity when scanning the same barcode again", () => {
    const result = applyScannedBarcode(
      [emptyRow({ productId: "product-1", barcode: "8901234567890", quantity: 2 })],
      products,
      "8901234567890",
    );

    expect(result.found).toBe(true);
    expect(result.items[0].quantity).toBe(3);
  });
});
