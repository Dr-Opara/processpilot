import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { IndustryPageTemplate } from "@/components/marketing/templates/IndustryPageTemplate";
import { franchisesContent } from "@/content/industries/franchises";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(franchisesContent.seo);

export default function FranchisesPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <IndustryPageTemplate content={franchisesContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
