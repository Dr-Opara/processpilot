import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SolutionPageTemplate } from "@/components/marketing/templates/SolutionPageTemplate";
import { operationsSolutionContent } from "@/content/solutions/operations";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(operationsSolutionContent.seo);

export default function OperationsSolutionPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <SolutionPageTemplate content={operationsSolutionContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
