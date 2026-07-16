import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { IndustryPageTemplate } from "@/components/marketing/templates/IndustryPageTemplate";
import { logisticsContent } from "@/content/industries/logistics";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(logisticsContent.seo);

export default function LogisticsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <IndustryPageTemplate content={logisticsContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
