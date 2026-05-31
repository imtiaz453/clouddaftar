import { getCompanySettings } from "@/actions/settings";
import { getTemplates } from "@/actions/templates";
import { getStores, getBranchesList, getEmployeesList } from "@/actions/locations";
import { SettingsClient } from "./settings-client";
import { serialize } from "@/lib/serialize";
import { checkPermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";

export async function SettingsPage() {
  try {
    const [
      canManageCompany,
      canManageSettings,
      canViewTemplates,
      canViewStores,
      canManageStores,
      canManageTemplates,
      canManageBranding,
      canManageTax,
    ] = await Promise.all([
      checkPermission(PERMISSIONS.COMPANY_SETTINGS_MANAGE),
      checkPermission(PERMISSIONS.SETTINGS_MANAGE),
      checkPermission(PERMISSIONS.TEMPLATES_VIEW),
      checkPermission(PERMISSIONS.STORES_VIEW),
      checkPermission(PERMISSIONS.STORES_MANAGE),
      checkPermission(PERMISSIONS.TEMPLATES_MANAGE),
      checkPermission(PERMISSIONS.BRANDING_MANAGE),
      checkPermission(PERMISSIONS.TAX_SETTINGS_MANAGE),
    ]);
    const [company, templates, stores, branches, employees] = await Promise.all([
      getCompanySettings(),
      canViewTemplates ? getTemplates() : Promise.resolve([]),
      canViewStores ? getStores() : Promise.resolve([]),
      canViewStores ? getBranchesList() : Promise.resolve([]),
      canViewStores ? getEmployeesList() : Promise.resolve([]),
    ]);
    if (!company) throw new Error("Company not found");
    const companyData = serialize(company);
    return (
      <SettingsClient
        companyData={companyData}
        templates={serialize(templates)}
        stores={serialize(stores)}
        branches={serialize(branches)}
        employees={serialize(employees)}
        capabilities={{
          canManageCompany,
          canManageSettings,
          canViewTemplates,
          canViewStores,
          canManageStores,
          canManageTemplates,
          canManageBranding,
          canManageTax,
        }}
      />
    );
  } catch (e) {
    console.error("SettingsPage runtime error:", e);
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load settings</p>
      </div>
    );
  }
}
