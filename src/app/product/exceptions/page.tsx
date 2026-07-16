import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ProductPageTemplate } from "@/components/marketing/templates/ProductPageTemplate";
import { exceptionsContent } from "@/content/product/exceptions";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(exceptionsContent.seo);

export default function ExceptionsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <ProductPageTemplate content={exceptionsContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
