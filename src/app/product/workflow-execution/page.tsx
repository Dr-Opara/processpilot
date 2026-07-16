import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ProductPageTemplate } from "@/components/marketing/templates/ProductPageTemplate";
import { workflowExecutionContent } from "@/content/product/workflow-execution";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(workflowExecutionContent.seo);

export default function WorkflowExecutionPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <ProductPageTemplate content={workflowExecutionContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
