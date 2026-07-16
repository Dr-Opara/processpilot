import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { IndustryPageTemplate } from "@/components/marketing/templates/IndustryPageTemplate";
import { healthcareOperationsContent } from "@/content/industries/healthcare-operations";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(
  healthcareOperationsContent.seo,
);

export default function HealthcareOperationsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <IndustryPageTemplate content={healthcareOperationsContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
