import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ServicePageTemplate } from "@/components/marketing/templates/ServicePageTemplate";
import { aiServiceContent } from "@/content/services/ai";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(aiServiceContent.seo);

export default function AiServicePage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <ServicePageTemplate content={aiServiceContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
