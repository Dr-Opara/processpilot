import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ProductPageTemplate } from "@/components/marketing/templates/ProductPageTemplate";
import { trainingContent } from "@/content/product/training";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(trainingContent.seo);

export default function TrainingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <ProductPageTemplate content={trainingContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
