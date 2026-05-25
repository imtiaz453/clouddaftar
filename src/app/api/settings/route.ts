import { NextRequest } from "next/server";
import {
  getCompanySettings,
  updateCompanySettings,
  updateCompanySettingsData,
  updatePermissionSettings,
  updateThemeSettings,
  updateTaxComplianceSettings,
} from "@/actions/settings";
import { successResponse, errorResponse } from "@/lib/api";
import {
  companySchema,
  companySettingsSchema,
  permissionsSettingsSchema,
  taxComplianceSettingsSchema,
  themeSettingsSchema,
} from "@/lib/validations";
import { ZodError } from "zod";

export async function GET() {
  try {
    const data = await getCompanySettings();
    return successResponse(data);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch settings");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const type = data._type;

    if (type === "settings") {
      const parsed = companySettingsSchema.parse(data);
      await updateCompanySettingsData(parsed);
    } else if (type === "permissions") {
      const parsed = permissionsSettingsSchema.parse(data);
      await updatePermissionSettings(parsed);
    } else if (type === "theme") {
      const parsed = themeSettingsSchema.parse(data);
      await updateThemeSettings(parsed);
    } else if (type === "tax-compliance") {
      const parsed = taxComplianceSettingsSchema.parse(data);
      await updateTaxComplianceSettings(parsed);
    } else {
      const parsed = companySchema.parse(data);
      await updateCompanySettings(parsed);
    }

    return successResponse(null, "Settings updated");
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(error.issues[0]?.message || "Validation error", 400);
    }
    return errorResponse(error instanceof Error ? error.message : "Failed to update settings");
  }
}
