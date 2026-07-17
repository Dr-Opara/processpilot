import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ProductPageTemplate } from "@/components/marketing/templates/ProductPageTemplate";
import { analyticsContent } from "@/content/product/analytics";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(analyticsContent.seo);

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <ProductPageTemplate content={analyticsContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
