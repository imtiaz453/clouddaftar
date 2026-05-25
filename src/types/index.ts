import type { User, Company, CompanyMembership } from "@prisma/client";

export type SafeUser = Omit<User, "passwordHash"> & {
  companies?: CompanyWithRole[];
};

export type CompanyWithRole = Company & {
  membership: CompanyMembership;
};

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  companyId: string;
  companySlug: string;
  role: string;
  activeLoginSessionId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DashboardStats {
  totalSales: number;
  totalPurchases: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockCount: number;
  monthlySales: number;
  /** Sales in the same-length window last month (for fair MTD comparison). */
  monthlySalesPriorPeriod: number;
  /** Percent change vs `monthlySalesPriorPeriod`; null when not meaningful. */
  monthlySalesChangePct: number | null;
  monthlyPurchases: number;
  salesTrend: { date: string; amount: number }[];
  lowStockItems: { id: string; name: string; stock: number; minStock: number }[];
  recentSales: {
    id: string;
    invoiceNumber: string;
    total: number;
    status: string;
    createdAt: Date;
    customerName: string | null;
  }[];
}

export interface ProductFormData {
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  stock: number;
  minStock: number;
  maxStock?: number;
  unit: string;
  tax: number;
  discount: number;
  categoryId?: string;
  isService: boolean;
  expiryDate?: string;
  image?: string;
}

export interface SaleFormData {
  customerId?: string;
  items: {
    productId: string;
    quantity: number;
    price: number;
    discount: number;
    tax: number;
  }[];
  discount: number;
  paymentMethod: string;
  notes?: string;
  paid: number;
}

export interface PurchaseFormData {
  supplierId?: string;
  items: {
    productId: string;
    quantity: number;
    price: number;
    discount: number;
    tax: number;
  }[];
  discount: number;
  paymentMethod: string;
  notes?: string;
  paid: number;
}

export interface CompanySettingsData {
  companyId?: string;
  name: string;
  slug?: string;
  logo?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  taxRate: number;
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
}
