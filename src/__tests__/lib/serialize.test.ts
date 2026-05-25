import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { serialize, serializeWithNumbers } from "@/lib/serialize";

describe("serialize", () => {
  it("serializes plain objects", () => {
    const input = { a: 1, b: "hello" };
    const result = serialize(input);
    expect(result).toEqual({ a: 1, b: "hello" });
  });

  it("serializes arrays", () => {
    const input = [1, 2, 3];
    expect(serialize(input)).toEqual([1, 2, 3]);
  });

  it("handles Date objects", () => {
    const date = new Date("2024-01-01");
    const result = serialize({ date });
    expect(result).toEqual({ date: "2024-01-01T00:00:00.000Z" });
  });

  it("removes undefined values", () => {
    const result = serialize({ a: 1, b: undefined });
    expect(result).toEqual({ a: 1 });
  });

  it("handles nested objects", () => {
    const input = { outer: { inner: [1, 2] } };
    expect(serialize(input)).toEqual({ outer: { inner: [1, 2] } });
  });

  it("converts Decimal-like objects before passing data to client components", () => {
    const decimal = { s: 1, e: 2, d: [1234], toString: () => "1234" };
    const result = serialize({ item: { price: decimal } });
    expect(result).toEqual({ item: { price: 1234 } });
  });

  it("converts Prisma Decimal instances before passing data to client components", () => {
    const result = serialize({ item: { price: new Prisma.Decimal("12.34") } });
    expect(result).toEqual({ item: { price: 12.34 } });
  });
});

describe("serializeWithNumbers", () => {
  it("converts Decimal-like objects to numbers", () => {
    const decimal = { s: 1, e: 2, d: [1234], toString: () => "1234" };
    const input = { amount: decimal };
    const result = serializeWithNumbers(input);
    expect(typeof result.amount).toBe("number");
  });

  it("leaves regular numbers unchanged", () => {
    const input = { amount: 123, name: "test" };
    const result = serializeWithNumbers(input);
    expect(result).toEqual({ amount: 123, name: "test" });
  });
});
