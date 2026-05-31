import { getTemplates, getCompanySettings } from "@/actions/templates";
import { TemplatesClient } from "./templates-client";
import { serialize } from "@/lib/serialize";
import { checkPermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";

export async function TemplatesPage() {
  try {
    const [templates, companySettings, canManage] = await Promise.all([
      getTemplates(),
      getCompanySettings().catch(() => null),
      checkPermission(PERMISSIONS.TEMPLATES_MANAGE),
    ]);
    const settings = companySettings?.settings ? serialize(companySettings.settings) : null;
    return <TemplatesClient templates={serialize(templates)} companySettings={settings} canManage={canManage} />;
  } catch {
    return <TemplatesClient templates={[]} companySettings={null} canManage={false} />;
  }
}
