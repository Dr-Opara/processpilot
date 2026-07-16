import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SolutionPageTemplate } from "@/components/marketing/templates/SolutionPageTemplate";
import { complianceSolutionContent } from "@/content/solutions/compliance";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(complianceSolutionContent.seo);

export default function ComplianceSolutionPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <SolutionPageTemplate content={complianceSolutionContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
