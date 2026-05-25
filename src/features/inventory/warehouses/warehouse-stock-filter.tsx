"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export function WarehouseStockFilter({
  warehouses,
  currentWarehouseId,
}: {
  warehouses: WarehouseOption[];
  currentWarehouseId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(warehouseId: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (warehouseId) params.set("warehouseId", warehouseId);
    else params.delete("warehouseId");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="whitespace-nowrap text-sm text-muted-foreground">Warehouse:</label>
      <select
        value={currentWarehouseId || ""}
        onChange={(e) => handleChange(e.target.value)}
        className="flex h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">All Warehouses</option>
        {warehouses.map((wh) => (
          <option key={wh.id} value={wh.id}>
            {wh.code} - {wh.name}
          </option>
        ))}
      </select>
    </div>
  );
}
