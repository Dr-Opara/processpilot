import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SolutionPageTemplate } from "@/components/marketing/templates/SolutionPageTemplate";
import { humanResourcesSolutionContent } from "@/content/solutions/human-resources";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(
  humanResourcesSolutionContent.seo,
);

export default function HumanResourcesSolutionPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <SolutionPageTemplate content={humanResourcesSolutionContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
