import { requireCompanyAuth } from "@/lib/auth-helper";
import { HelpContent } from "@/features/help/help-content";
import { PageHeader } from "@/components/shared/page-header";

export default async function HelpPage() {
  await requireCompanyAuth();
  return (
    <div className="space-y-6">
      <PageHeader title="Help & Support" description="Documentation, FAQs, and support resources" />
      <HelpContent />
    </div>
  );
}
