import { describe, it, expect } from "vitest";
import {
  companySchema,
  companySettingsSchema,
  taxComplianceSettingsSchema,
  themeSettingsSchema,
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  stockAdjustSchema,
} from "@/lib/validations";
import { ZATCA_SIMULATION_ENDPOINTS } from "@/lib/tax/zatca-endpoints";

describe("companySchema", () => {
  it("accepts valid company data", () => {
    const result = companySchema.safeParse({ name: "Test Co" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = companySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = companySchema.safeParse({ name: "Test", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("accepts missing optional fields", () => {
    const result = companySchema.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("accepts valid login", () => {
    const result = loginSchema.safeParse({ email: "test@test.com", password: "12345678" });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = loginSchema.safeParse({ password: "12345678" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "bad", password: "12345678" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid registration", () => {
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "test@test.com",
      password: "12345678",
      companyName: "Test Co",
      country: "SA",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported registration locality", () => {
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "test@test.com",
      password: "12345678",
      companyName: "Test Co",
      country: "AE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = registerSchema.safeParse({
      name: "Test",
      email: "test@test.com",
      password: "123",
      companyName: "Test",
    });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts valid reset", () => {
    const result = resetPasswordSchema.safeParse({
      password: "Newpassword123",
      confirmPassword: "Newpassword123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short password", () => {
    const result = resetPasswordSchema.safeParse({ token: "abc123", password: "123" });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("accepts valid change", () => {
    const result = changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "newlongpass" });
    expect(result.success).toBe(true);
  });

  it("rejects short new password", () => {
    const result = changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "short" });
    expect(result.success).toBe(false);
  });
});

describe("stockAdjustSchema", () => {
  it("accepts valid adjustment", () => {
    const result = stockAdjustSchema.safeParse({
      productId: "abc123",
      quantity: 10,
      type: "ADJUSTMENT",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = stockAdjustSchema.safeParse({
      productId: "abc123",
      quantity: 10,
      type: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing productId", () => {
    const result = stockAdjustSchema.safeParse({ quantity: 10, type: "ADJUSTMENT" });
    expect(result.success).toBe(false);
  });
});

describe("companySettingsSchema", () => {
  it("accepts valid settings", () => {
    const result = companySettingsSchema.safeParse({
      invoicePrefix: "INV-",
      invoiceNumberLength: 5,
      lowStockThreshold: 10,
      decimalPlaces: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid decimal places", () => {
    const result = companySettingsSchema.safeParse({ decimalPlaces: -1 });
    expect(result.success).toBe(false);
  });
});

describe("themeSettingsSchema", () => {
  it("accepts valid theme", () => {
    const result = themeSettingsSchema.safeParse({
      sidebarStyle: "gradient",
      borderRadius: "normal",
      layoutDensity: "comfortable",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid sidebar style", () => {
    const result = themeSettingsSchema.safeParse({ sidebarStyle: "invalid" });
    expect(result.success).toBe(false);
  });
});

describe("taxComplianceSettingsSchema", () => {
  const validZatcaPayload = {
    taxComplianceMode: "ZATCA",
    zatcaSettings: {
      sellerName: "Test Seller",
      vatRegNo: "123456789012345",
    },
  };

  it("accepts the new ZATCA simulation endpoints", () => {
    const result = taxComplianceSettingsSchema.safeParse({
      ...validZatcaPayload,
      zatcaSettings: {
        ...validZatcaPayload.zatcaSettings,
        endpoint: ZATCA_SIMULATION_ENDPOINTS.reportingSingle,
        complianceEndpoint: ZATCA_SIMULATION_ENDPOINTS.compliance,
        complianceInvoicesEndpoint: ZATCA_SIMULATION_ENDPOINTS.complianceInvoices,
        productionCsidsEndpoint: ZATCA_SIMULATION_ENDPOINTS.productionCsids,
        reportingEndpoint: ZATCA_SIMULATION_ENDPOINTS.reportingSingle,
        clearanceEndpoint: ZATCA_SIMULATION_ENDPOINTS.clearanceSingle,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed ZATCA endpoint URLs", () => {
    const result = taxComplianceSettingsSchema.safeParse({
      ...validZatcaPayload,
      zatcaSettings: {
        ...validZatcaPayload.zatcaSettings,
        reportingEndpoint: "not-a-url",
      },
    });

    expect(result.success).toBe(false);
  });
});
