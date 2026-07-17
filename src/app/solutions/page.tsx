import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PageHero } from "@/components/marketing/sections/PageHero";
import { RelatedLinks } from "@/components/marketing/sections/RelatedLinks";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { primaryNav } from "@/content/site";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Solutions by function",
  description:
    "ProcessPilot for operations, human resources, compliance, customer operations, and multi-location teams.",
  path: "/solutions",
});

export default function SolutionsOverviewPage() {
  const solutionLinks = primaryNav[1].items.map((item) => ({
    label: item.label,
    href: item.href,
    description: item.description ?? "",
  }));

  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <PageHero
          eyebrow="Solutions"
          headline="Built for the team that owns the process, not just IT"
          intro="Every function has different work to standardize. ProcessPilot adapts to what operations, HR, compliance, customer operations, and multi-location teams each need."
          accent="cobalt"
          primary={{ label: "Request a demo", href: "/request-demo" }}
          secondary={{ label: "Start free trial", href: "/start-trial" }}
        />
        <RelatedLinks title="Find your function" links={solutionLinks} />
        <CtaBand
          title="Tell us what you're trying to standardize"
          description="A demo tailored to your team's actual process is more useful than a generic walkthrough."
          primary={{ label: "Request a demo", href: "/request-demo" }}
          secondary={{ label: "See pricing", href: "/pricing" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
