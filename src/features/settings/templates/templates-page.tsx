import { getTemplates, getCompanySettings } from "@/actions/templates";
import { TemplatesClient } from "./templates-client";
import { serialize } from "@/lib/serialize";

export async function TemplatesPage() {
  try {
    const [templates, companySettings] = await Promise.all([
      getTemplates(),
      getCompanySettings().catch(() => null),
    ]);
    const settings = companySettings?.settings ? serialize(companySettings.settings) : null;
    return <TemplatesClient templates={serialize(templates)} companySettings={settings} />;
  } catch {
    return <TemplatesClient templates={[]} companySettings={null} />;
  }
}
