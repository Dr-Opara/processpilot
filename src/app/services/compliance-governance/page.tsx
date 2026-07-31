import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ServicePageTemplate } from "@/components/marketing/templates/ServicePageTemplate";
import { complianceGovernanceServiceContent } from "@/content/services/compliance-governance";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(complianceGovernanceServiceContent.seo);

export default function ComplianceGovernanceServicePage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <ServicePageTemplate content={complianceGovernanceServiceContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
