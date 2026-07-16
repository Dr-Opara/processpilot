import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SolutionPageTemplate } from "@/components/marketing/templates/SolutionPageTemplate";
import { multiLocationSolutionContent } from "@/content/solutions/multi-location";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(
  multiLocationSolutionContent.seo,
);

export default function MultiLocationSolutionPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <SolutionPageTemplate content={multiLocationSolutionContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
