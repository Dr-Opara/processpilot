import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { IndustryPageTemplate } from "@/components/marketing/templates/IndustryPageTemplate";
import { propertyManagementContent } from "@/content/industries/property-management";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(propertyManagementContent.seo);

export default function PropertyManagementPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <IndustryPageTemplate content={propertyManagementContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
