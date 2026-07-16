import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PageHero } from "@/components/marketing/sections/PageHero";
import { PillarsGrid } from "@/components/marketing/sections/PillarsGrid";
import { RelatedLinks } from "@/components/marketing/sections/RelatedLinks";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { primaryNav } from "@/content/site";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Product overview",
  description:
    "Govern knowledge, design workflows, guide employees, and improve operations — the four pillars of the ProcessPilot platform.",
  path: "/product",
});

export default function ProductOverviewPage() {
  const productLinks = primaryNav[0].items.map((item) => ({
    label: item.label,
    href: item.href,
    description: item.description ?? "",
  }));

  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <PageHero
          eyebrow="Product"
          headline="One platform for knowledge, workflows, training, and evidence"
          intro="ProcessPilot is organized around four jobs: govern the source material, design the workflow, guide the people doing the work, and improve it over time."
          accent="cobalt"
          primary={{ label: "Request a demo", href: "/request-demo" }}
          secondary={{ label: "Start free trial", href: "/start-trial" }}
        />
        <PillarsGrid />
        <RelatedLinks title="Explore every product area" links={productLinks} />
        <CtaBand
          title="Not sure where to start?"
          description="Most teams start with knowledge and process builder, then add training and analytics as workflows mature."
          primary={{ label: "Talk to us", href: "/request-demo" }}
          secondary={{ label: "See pricing", href: "/pricing" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
