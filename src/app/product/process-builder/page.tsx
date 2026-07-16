import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ProductPageTemplate } from "@/components/marketing/templates/ProductPageTemplate";
import { processBuilderContent } from "@/content/product/process-builder";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(processBuilderContent.seo);

export default function ProcessBuilderPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <ProductPageTemplate content={processBuilderContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
