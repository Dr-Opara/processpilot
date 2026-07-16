import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ProductPageTemplate } from "@/components/marketing/templates/ProductPageTemplate";
import { knowledgeContent } from "@/content/product/knowledge";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(knowledgeContent.seo);

export default function KnowledgePage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <ProductPageTemplate content={knowledgeContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
