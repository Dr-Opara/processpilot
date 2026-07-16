import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { IndustryPageTemplate } from "@/components/marketing/templates/IndustryPageTemplate";
import { professionalServicesContent } from "@/content/industries/professional-services";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(
  professionalServicesContent.seo,
);

export default function ProfessionalServicesPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <IndustryPageTemplate content={professionalServicesContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
