import { RolesClient } from "./roles-client";
import { getCompanySettings } from "@/actions/settings";
import { serialize } from "@/lib/serialize";
import { PageHeader } from "@/components/shared/page-header";

export async function RolesPage() {
  const company = await getCompanySettings().catch(() => null);
  const rolePermissions = company?.settings?.rolePermissions
    ? serialize(company.settings.rolePermissions)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Build role presets with module-level access, tab-level control, and action-level permissions."
      />
      <RolesClient rolePermissions={rolePermissions} />
    </div>
  );
}
