import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SolutionPageTemplate } from "@/components/marketing/templates/SolutionPageTemplate";
import { customerOperationsSolutionContent } from "@/content/solutions/customer-operations";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(
  customerOperationsSolutionContent.seo,
);

export default function CustomerOperationsSolutionPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <SolutionPageTemplate content={customerOperationsSolutionContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
