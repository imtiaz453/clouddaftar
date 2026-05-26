import { z } from "zod";

export const companySchema = z.object({
  name: z.string().min(1, "Company name is required").max(100),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .transform((value) => {
      if (!value) return "";
      return /^https?:\/\//i.test(value) ? value : `https://${value}`;
    })
    .pipe(z.string().url("Website must be a valid URL").or(z.literal("")))
    .optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().length(2).optional(),
  taxId: z.string().optional(),
  taxName: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  currency: z.string().length(3).optional(),
  currencySymbol: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
  fiscalYearStart: z.string().optional(),
  logo: z.string().optional(),
});

export const companySettingsSchema = z.object({
  invoicePrefix: z.string().max(20).optional(),
  salesOrderPrefix: z.string().max(20).optional(),
  proformaInvoicePrefix: z.string().max(20).optional(),
  quotationPrefix: z.string().max(20).optional(),
  purchaseOrderPrefix: z.string().max(20).optional(),
  invoiceSuffix: z.string().max(20).optional(),
  invoiceNumberLength: z.number().int().min(3).max(10).optional(),
  defaultInvoiceTemplate: z.string().optional(),
  defaultThermalInvoiceTemplate: z.string().optional(),
  defaultQuotationTemplate: z.string().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  defaultPaymentMethod: z
    .enum([
      "CASH",
      "CARD",
      "BANK_TRANSFER",
      "MOBILE_PAYMENT",
      "CHEQUE",
      "EASYPAISA",
      "JAZZCASH",
      "ONLINE_TRANSFER",
      "OTHER",
    ])
    .optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  skuPrefix: z.string().optional(),
  autoGenerateSKU: z.boolean().optional(),
  enableBarcodeScanning: z.boolean().optional(),
  enableNegativeStock: z.boolean().optional(),
  enableExpiryTracking: z.boolean().optional(),
  currencyPosition: z.enum(["left", "right"]).optional(),
  thousandSeparator: z.enum([",", ".", " "]).optional(),
  decimalSeparator: z.enum([".", ","]).optional(),
  decimalPlaces: z.number().int().min(0).max(6).optional(),
  language: z.enum(["en", "ur", "ar", "dual"]).optional(),
  printerBridgeSettings: z
    .object({
      enabled: z.boolean().optional(),
      bridgeUrl: z.string().url("Bridge URL must be a valid URL").or(z.literal("")).optional(),
      mode: z.enum(["HTTP", "RAW_TCP"]).optional(),
      printerName: z.string().max(100).optional(),
      paperWidth: z.enum(["58", "80"]).optional(),
      codePage: z.string().max(40).optional(),
      copies: z.number().int().min(1).max(5).optional(),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
      autoPrintReceipts: z.boolean().optional(),
      openCashDrawer: z.boolean().optional(),
      cutPaper: z.boolean().optional(),
      authToken: z.string().max(500).optional(),
    })
    .optional(),
});

export const permissionsSettingsSchema = z.object({
  rolePermissions: z.record(z.array(z.string())).optional(),
});

export const themeSettingsSchema = z.object({
  sidebarColor: z.string().optional(),
  sidebarStyle: z.enum(["gradient", "solid", "minimal", "glass"]).optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  fontFamily: z.string().optional(),
  borderRadius: z.enum(["none", "small", "normal", "large"]).optional(),
  layoutDensity: z.enum(["compact", "comfortable", "spacious"]).optional(),
  isDarkMode: z.boolean().optional(),
});

export const taxComplianceSettingsSchema = z
  .object({
    _type: z.literal("tax-compliance").optional(),
    taxComplianceMode: z.enum(["NONE", "FBR", "ZATCA"]).optional(),
    fbrCredentials: z
      .object({
        username: z.string().optional(),
        password: z.string().optional(),
      })
      .optional(),
    fbrPosId: z.string().optional(),
    zatcaSettings: z
      .object({
        enabled: z.boolean().optional(),
        mode: z.enum(["LOCAL", "SIMULATION", "PRODUCTION"]).optional(),
        sellerName: z.string().optional(),
        vatRegNo: z.string().optional(),
        crNo: z.string().optional(),
        address: z.string().optional(),
        phaseMode: z.enum(["PHASE_1", "PHASE_2"]).optional(),
        environment: z.enum(["SIMULATION", "PRODUCTION"]).optional(),
        otp: z.string().optional(),
        branchName: z.string().optional(),
        location: z.string().optional(),
        industry: z.string().optional(),
        invoiceType: z.enum(["1100", "1000", "0100"]).optional(),
        csid: z.string().optional(),
        csidSecret: z.string().optional(),
        productionCsid: z.string().optional(),
        productionCsidSecret: z.string().optional(),
        complianceCsid: z.string().optional(),
        complianceCsidSecret: z.string().optional(),
        privateKeyPem: z.string().optional(),
        certificatePem: z.string().optional(),
        cryptographicStamp: z.string().optional(),
        previousInvoiceHash: z.string().optional(),
        invoiceCounter: z.string().optional(),
        autoSubmitSimulation: z.union([z.boolean(), z.string()]).optional(),
        endpoint: z.string().url().optional().or(z.literal("")),
        complianceEndpoint: z.string().url().optional().or(z.literal("")),
        complianceInvoicesEndpoint: z.string().url().optional().or(z.literal("")),
        productionCsidsEndpoint: z.string().url().optional().or(z.literal("")),
        reportingEndpoint: z.string().url().optional().or(z.literal("")),
        clearanceEndpoint: z.string().url().optional().or(z.literal("")),
        deviceName: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.taxComplianceMode !== "ZATCA") return;

    const sellerName = data.zatcaSettings?.sellerName?.trim();
    const vatRegNo = data.zatcaSettings?.vatRegNo?.trim();

    if (!sellerName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["zatcaSettings", "sellerName"],
        message: "ZATCA seller name is required",
      });
    }

    if (!/^\d{15}$/.test(vatRegNo || "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["zatcaSettings", "vatRegNo"],
        message: "ZATCA VAT registration number must be exactly 15 digits",
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(1, "Company name is required"),
  country: z.enum(["PK", "SA"]).default("PK"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const verifyPasswordResetCodeSchema = z.object({
  email: z.string().email("Valid email is required"),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit verification code"),
});

export const resendPasswordResetCodeSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const passwordStrengthSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const resetPasswordSchema = z
  .object({
    password: passwordStrengthSchema,
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  image: z.string().optional(),
});

export const saleSchema = z.object({
  customerId: z.string().optional(),
  branchId: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
        price: z.number().min(0),
        discount: z.number().min(0).optional(),
        tax: z.number().min(0).optional(),
        description: z.string().optional(),
      }),
    )
    .min(1, "At least one item is required"),
  paymentMethod: z
    .enum([
      "CASH",
      "CARD",
      "BANK_TRANSFER",
      "MOBILE_PAYMENT",
      "CHEQUE",
      "EASYPAISA",
      "JAZZCASH",
      "ONLINE_TRANSFER",
      "OTHER",
    ])
    .optional(),
  paid: z.number().min(0).optional(),
  dueDate: z.string().optional().nullable(),
  discount: z.number().min(0).optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

export const saleCreateSchema = saleSchema.extend({
  status: z
    .enum([
      "DRAFT",
      "CONFIRMED",
      "PROFORMA",
      "COMPLETED",
      "PARTIALLY_REFUNDED",
      "REFUNDED",
      "CANCELLED",
    ])
    .optional(),
  taxComplianceMode: z.enum(["NONE", "FBR", "ZATCA"]).optional(),
  buyerTaxNumber: z.string().optional(),
});

export const saleUpdateSchema = saleCreateSchema.partial();

export const purchaseSchema = z.object({
  supplierId: z.string().optional(),
  branchId: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
        price: z.number().min(0),
        discount: z.number().min(0).optional(),
        tax: z.number().min(0).optional(),
        description: z.string().optional(),
      }),
    )
    .min(1, "At least one item is required"),
  paymentMethod: z
    .enum([
      "CASH",
      "CARD",
      "BANK_TRANSFER",
      "MOBILE_PAYMENT",
      "CHEQUE",
      "EASYPAISA",
      "JAZZCASH",
      "ONLINE_TRANSFER",
      "OTHER",
    ])
    .optional(),
  paid: z.number().min(0).optional(),
  dueDate: z.string().optional().nullable(),
  discount: z.number().min(0).optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

export const purchaseCreateSchema = purchaseSchema.extend({
  status: z.enum(["DRAFT", "PENDING", "RECEIVED", "PARTIALLY_RECEIVED", "CANCELLED"]).optional(),
});

export const purchaseUpdateSchema = purchaseCreateSchema.partial();

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  purchasePrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  wholesalePrice: z.number().optional(),
  stock: z.number().int().min(0),
  minStock: z.number().int().min(0),
  maxStock: z.number().int().optional(),
  unit: z.string().optional(),
  tax: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  categoryId: z.string().optional().nullable(),
  isService: z.boolean().optional(),
  trackingMode: z.enum(["NONE", "LOT", "SERIAL"]).optional(),
  expiryDate: z.string().optional(),
  image: z.string().optional(),
});

export const productUpdateSchema = productSchema.partial().extend({
  id: z.string().min(1, "Product ID is required"),
});

export const stockAdjustSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  branchId: z.string().optional(),
  warehouseId: z.string().optional(),
  quantity: z.number().int(),
  type: z.enum(["ADJUSTMENT", "RETURN", "DAMAGE", "LOST", "FOUND"]),
  notes: z.string().optional(),
});

export const stockTransferSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  fromWarehouseId: z.string().min(1, "Source warehouse is required"),
  toWarehouseId: z.string().min(1, "Destination warehouse is required"),
  quantity: z.number().int().positive("Quantity must be greater than zero"),
  notes: z.string().optional(),
});

export const productLotSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  lotNumber: z.string().min(1, "Lot or serial number is required"),
  serialNumber: z.string().optional(),
  quantity: z.number().int().positive("Quantity must be greater than zero"),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

export const customerCreateSchema = z.object({
  name: z.string().min(1, "Customer name is required").max(100),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  taxId: z.string().optional(),
  creditLimit: z.number().min(0).optional(),
});

export const customerUpdateSchema = z.object({
  name: z.string().min(1, "Customer name is required").max(100).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  taxId: z.string().optional(),
  creditLimit: z.number().min(0).optional(),
});

export const supplierCreateSchema = z.object({
  name: z.string().min(1, "Supplier name is required").max(100),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  taxId: z.string().optional(),
});

export const supplierPaymentSchema = z.object({
  supplierId: z.string().min(1, "Supplier ID is required"),
  purchaseIds: z.array(z.string().min(1)).min(1, "At least one purchase is required"),
  amount: z.number().positive("Payment amount must be positive"),
  paymentMethod: z.enum([
    "CASH",
    "CARD",
    "BANK_TRANSFER",
    "MOBILE_PAYMENT",
    "CHEQUE",
    "EASYPAISA",
    "JAZZCASH",
    "ONLINE_TRANSFER",
    "OTHER",
  ]),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paymentDate: z.string().optional(),
});

export const paymentCreateSchema = z
  .object({
    customerId: z.string().optional(),
    supplierId: z.string().optional(),
    amount: z.number().positive("Payment amount must be positive"),
    paymentMethod: z
      .enum([
        "CASH",
        "CARD",
        "BANK_TRANSFER",
        "MOBILE_PAYMENT",
        "CHEQUE",
        "EASYPAISA",
        "JAZZCASH",
        "ONLINE_TRANSFER",
        "OTHER",
      ])
      .optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    paymentDate: z.string().optional(),
    allocations: z
      .array(
        z.object({
          saleId: z.string().optional(),
          purchaseId: z.string().optional(),
          allocatedAmount: z.number().positive("Allocation amount must be positive"),
        }),
      )
      .min(1, "At least one allocation is required"),
  })
  .refine((data) => Boolean(data.customerId) !== Boolean(data.supplierId), {
    message: "Provide either customerId or supplierId, not both",
  })
  .refine(
    (data) =>
      data.allocations.every((allocation) =>
        data.customerId
          ? Boolean(allocation.saleId) && !allocation.purchaseId
          : Boolean(allocation.purchaseId) && !allocation.saleId,
      ),
    { message: "Allocations must match payment type" },
  );

const quotationItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  description: z.string().optional(),
});

export const quotationCreateSchema = z.object({
  customerId: z.string().optional(),
  items: z.array(quotationItemSchema).min(1, "At least one item is required"),
  discount: z.number().min(0).optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  validUntil: z.string().optional(),
  status: z
    .enum(["DRAFT", "SENT", "ACCEPTED", "CONVERTED_TO_SALE", "REJECTED", "EXPIRED"])
    .optional(),
});

export const quotationUpdateSchema = quotationCreateSchema.partial();
