import { getCompanySettings } from "@/actions/settings";
import { getTemplates } from "@/actions/templates";
import { SettingsClient } from "./settings-client";
import { serialize } from "@/lib/serialize";

export async function SettingsPage() {
  try {
    const [company, templates] = await Promise.all([getCompanySettings(), getTemplates()]);
    if (!company) throw new Error("Company not found");
    const companyData = serialize(company);
    return <SettingsClient companyData={companyData} templates={serialize(templates)} />;
  } catch (e) {
    console.error("SettingsPage runtime error:", e);
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load settings</p>
      </div>
    );
  }
}
