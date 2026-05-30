import { getStockTransfers } from "@/actions/inventory-new";
import { TransfersListClient } from "./transfers-list-client";

type SafePaginatedTransfers = {
  data: unknown[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const EMPTY_TRANSFERS: SafePaginatedTransfers = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
};

function normalizeTransfersResult(result: unknown): SafePaginatedTransfers {
  if (!result || typeof result !== "object") return EMPTY_TRANSFERS;

  const value = result as Partial<SafePaginatedTransfers> & { data?: unknown };
  const data = Array.isArray(value.data) ? value.data : Array.isArray(result) ? result : [];

  return {
    data,
    total: typeof value.total === "number" ? value.total : data.length,
    page: typeof value.page === "number" && value.page > 0 ? value.page : 1,
    pageSize: typeof value.pageSize === "number" && value.pageSize > 0 ? value.pageSize : 20,
    totalPages:
      typeof value.totalPages === "number" && value.totalPages >= 0
        ? value.totalPages
        : data.length > 0
          ? 1
          : 0,
  };
}

export default async function TransfersPage() {
  try {
    const data = await getStockTransfers({ page: 1, pageSize: 20 });
    return <TransfersListClient initialData={normalizeTransfersResult(data) as any} />;
  } catch (error) {
    console.error("TransfersPage failed to load stock transfers:", error);
    return <TransfersListClient initialData={EMPTY_TRANSFERS as any} />;
  }
}
