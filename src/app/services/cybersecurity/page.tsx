import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ServicePageTemplate } from "@/components/marketing/templates/ServicePageTemplate";
import { cybersecurityServiceContent } from "@/content/services/cybersecurity";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(cybersecurityServiceContent.seo);

export default function CybersecurityServicePage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <ServicePageTemplate content={cybersecurityServiceContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
