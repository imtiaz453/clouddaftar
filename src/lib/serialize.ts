function isDecimal(
  value: unknown,
): value is { toNumber?: () => number; toString: () => string; s?: number; e?: number; d?: number[] } {
  if (value === null || value === undefined || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  const constructorName = (value as { constructor?: { name?: string } }).constructor?.name || "";
  return (
    (typeof obj.toNumber === "function" && typeof obj.toString === "function") ||
    constructorName === "Decimal" ||
    (typeof obj.toString === "function" &&
      typeof obj.s === "number" &&
      typeof obj.e === "number" &&
      Array.isArray(obj.d))
  );
}

function convertDecimals(value: unknown): unknown {
  if (isDecimal(value)) {
    return typeof value.toNumber === "function" ? value.toNumber() : Number(value.toString());
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(convertDecimals);
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = convertDecimals(v);
    }
    return result;
  }
  return value;
}

export function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(convertDecimals(data)));
}

export function serializeWithNumbers<T>(data: T): T {
  return JSON.parse(JSON.stringify(convertDecimals(data)));
}
