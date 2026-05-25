import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LineItemEditor,
  calculateLineTotal,
  calculateTotals,
  type LineItem,
  type ProductOption,
} from "@/components/shared/line-item-editor";

const sampleProducts: ProductOption[] = [
  {
    id: "p1",
    name: "Product A",
    sku: "SKU001",
    barcode: "123456",
    sellingPrice: 100,
    purchasePrice: 60,
    tax: 10,
    unit: "pcs",
    stock: 50,
    isActive: true,
  },
  {
    id: "p2",
    name: "Product B",
    sku: "SKU002",
    barcode: "789012",
    sellingPrice: 200,
    purchasePrice: 120,
    tax: 5,
    unit: "box",
    stock: 20,
    isActive: true,
  },
  {
    id: "p3",
    name: "Inactive",
    sku: "SKU003",
    barcode: "999999",
    sellingPrice: 50,
    purchasePrice: 25,
    tax: 0,
    unit: "pcs",
    stock: 10,
    isActive: false,
  },
];

function emptyRow(overrides?: Partial<LineItem>): LineItem {
  return {
    id: "r1",
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

describe("calculateLineTotal", () => {
  it("calculates total with no discount or tax", () => {
    const item = emptyRow({ price: 100, quantity: 2 });
    expect(calculateLineTotal(item)).toBe(200);
  });

  it("subtracts discount from line total", () => {
    const item = emptyRow({ price: 100, quantity: 2, discount: 20 });
    expect(calculateLineTotal(item)).toBe(180);
  });

  it("applies tax on discounted amount", () => {
    const item = emptyRow({ price: 100, quantity: 2, discount: 20, tax: 10 });
    expect(calculateLineTotal(item)).toBe(198);
  });

  it("handles zero quantity", () => {
    const item = emptyRow({ price: 100, quantity: 0 });
    expect(calculateLineTotal(item)).toBe(0);
  });
});

describe("calculateTotals", () => {
  const items: LineItem[] = [
    emptyRow({ id: "1", price: 100, quantity: 2, discount: 10, tax: 10 }),
    emptyRow({ id: "2", price: 200, quantity: 1, discount: 0, tax: 5 }),
  ];

  it("calculates subtotal", () => {
    const result = calculateTotals(items);
    expect(result.subtotal).toBe(400);
  });

  it("calculates total item discount", () => {
    const result = calculateTotals(items);
    expect(result.totalDiscount).toBe(10);
  });

  it("includes global discount", () => {
    const result = calculateTotals(items, 50);
    expect(result.totalDiscount).toBe(60);
  });

  it("calculates total tax", () => {
    const result = calculateTotals(items);
    expect(result.totalTax).toBe(29);
  });

  it("calculates grand total", () => {
    const result = calculateTotals(items);
    expect(result.grandTotal).toBe(419);
  });

  it("returns count of items", () => {
    const result = calculateTotals(items);
    expect(result.itemCount).toBe(2);
  });

  it("handles empty items", () => {
    const result = calculateTotals([]);
    expect(result.subtotal).toBe(0);
    expect(result.totalDiscount).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.grandTotal).toBe(0);
    expect(result.itemCount).toBe(0);
  });
});

describe("LineItemEditor", () => {
  it("renders initial items", () => {
    const items = [
      emptyRow({ productId: "p1", productName: "Product A", quantity: 2, price: 100 }),
    ];
    render(<LineItemEditor items={items} onChange={() => {}} products={sampleProducts} />);
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Product A")).toBeInTheDocument();
  });

  it("adds a row via add button", async () => {
    const user = userEvent.setup();
    const items = [emptyRow({ id: "r1" })];
    const onChange = vi.fn();
    render(<LineItemEditor items={items} onChange={onChange} products={sampleProducts} />);
    await user.click(screen.getByRole("button", { name: /add line/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.anything(), expect.anything()]),
    );
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it("removes a row via remove button", async () => {
    const user = userEvent.setup();
    const items = [emptyRow({ id: "r1" }), emptyRow({ id: "r2" })];
    const onChange = vi.fn();
    render(<LineItemEditor items={items} onChange={onChange} products={sampleProducts} />);
    const removeButtons = screen.getAllByTitle("Remove");
    await user.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: "r2" })]);
  });

  it("duplicates a row", async () => {
    const user = userEvent.setup();
    const items = [emptyRow({ id: "r1", productName: "Original" })];
    const onChange = vi.fn();
    render(<LineItemEditor items={items} onChange={onChange} products={sampleProducts} />);
    await user.click(screen.getByTitle("Duplicate"));
    expect(onChange).toHaveBeenCalledOnce();
    const result = onChange.mock.calls[0][0];
    expect(result).toHaveLength(2);
    expect(result[1].productName).toBe("Original");
  });

  it("does not remove last remaining row", async () => {
    const user = userEvent.setup();
    const items = [emptyRow({ id: "r1" })];
    const onChange = vi.fn();
    render(<LineItemEditor items={items} onChange={onChange} products={sampleProducts} />);
    await user.click(screen.getByTitle("Remove"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("updates quantity field", async () => {
    const user = userEvent.setup();
    const items = [emptyRow({ id: "r1", productName: "Test", quantity: 1 })];
    const onChange = vi.fn();
    render(<LineItemEditor items={items} onChange={onChange} products={sampleProducts} />);
    const qtyInput = screen.getByDisplayValue("1");
    await user.clear(qtyInput);
    await user.type(qtyInput, "5");
    expect(onChange).toHaveBeenCalled();
  });

  it("selects a product from searched results", async () => {
    const user = userEvent.setup();
    const items = [emptyRow({ id: "r1" })];
    const onChange = vi.fn();
    render(<LineItemEditor items={items} onChange={onChange} products={sampleProducts} />);

    await user.type(screen.getByPlaceholderText(/search or scan product/i), "Product B");
    await user.click(await screen.findByRole("button", { name: /Product B/i }));

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: "r1",
        productId: "p2",
        productName: "Product B",
        sku: "SKU002",
        price: 200,
        quantity: 1,
        discount: 0,
        tax: 5,
      }),
    ]);
  });

  it("uses the saved default tax when the selected product has no tax", async () => {
    const user = userEvent.setup();
    const products: ProductOption[] = [
      {
        id: "p4",
        name: "Taxless Item",
        sku: "SKU004",
        barcode: null,
        sellingPrice: "125.50",
        purchasePrice: 80,
        tax: 0,
        unit: "pcs",
        stock: 12,
        isActive: true,
      },
    ];
    const onChange = vi.fn();
    render(
      <LineItemEditor
        items={[emptyRow({ id: "r1" })]}
        onChange={onChange}
        products={products}
        defaultTaxRate={17}
      />,
    );

    await user.type(screen.getByPlaceholderText(/search or scan product/i), "Taxless");
    await user.click(await screen.findByRole("button", { name: /Taxless Item/i }));

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        productId: "p4",
        price: 125.5,
        quantity: 1,
        discount: 0,
        tax: 17,
      }),
    ]);
  });

  it("marks the portal dropdown itself as interactive", async () => {
    const user = userEvent.setup();
    const items = [emptyRow({ id: "r1" })];
    render(<LineItemEditor items={items} onChange={() => {}} products={sampleProducts} />);

    await user.type(screen.getByPlaceholderText(/search or scan product/i), "Product");

    const dropdown = document.querySelector('[data-product-dropdown="true"]');
    expect(dropdown).toBeInTheDocument();
    expect(dropdown).toHaveStyle({ pointerEvents: "auto" });
    expect(dropdown).toHaveClass("overflow-y-auto");
  });

  it("keeps the product dropdown inside dialog containers", async () => {
    const user = userEvent.setup();
    const items = [emptyRow({ id: "r1" })];
    render(
      <div role="dialog">
        <LineItemEditor items={items} onChange={() => {}} products={sampleProducts} />
      </div>,
    );

    await user.type(screen.getByPlaceholderText(/search or scan product/i), "Product");

    const dialog = screen.getByRole("dialog");
    const dropdown = dialog.querySelector('[data-product-dropdown="true"]');
    expect(dropdown).toBeInTheDocument();
    expect(dropdown).toHaveStyle({ position: "absolute", pointerEvents: "auto" });
    expect(dropdown).toHaveClass("overflow-y-auto");
  });

  it("shows barcode input when enabled", () => {
    render(
      <LineItemEditor
        items={[]}
        onChange={() => {}}
        products={sampleProducts}
        showBarcode={true}
      />,
    );
    expect(screen.getByPlaceholderText(/scan|barcode/i)).toBeInTheDocument();
  });

  it("hides barcode input when disabled", () => {
    render(
      <LineItemEditor
        items={[]}
        onChange={() => {}}
        products={sampleProducts}
        showBarcode={false}
      />,
    );
    expect(screen.queryByPlaceholderText(/scan|barcode/i)).not.toBeInTheDocument();
  });
});
