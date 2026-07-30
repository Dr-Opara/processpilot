import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PageHero } from "@/components/marketing/sections/PageHero";
import { PricingTable } from "@/components/marketing/sections/PricingTable";
import { CapabilitiesGrid } from "@/components/marketing/sections/CapabilitiesGrid";
import { FaqAccordion } from "@/components/marketing/sections/FaqAccordion";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { pricingConsiderations } from "@/content/pricing";
import { pricingFaqs } from "@/content/pricing-faqs";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Pricing",
  description:
    "ProcessPilot plans for single teams, multi-location businesses, and enterprise organizations.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <PageHero
          eyebrow="Pricing"
          headline="Plans that scale with locations and departments, not seats alone"
          intro="From a single team's first workflow to an enterprise rollout across every location. Start on Team or Business with a monthly or annual plan, or talk to sales about an Enterprise rollout."
          accent="cobalt"
        />
        <PricingTable />
        <CapabilitiesGrid
          title="What to consider beyond the plan tier"
          items={pricingConsiderations}
        />
        <FaqAccordion title="Pricing questions" items={pricingFaqs} />
        <CtaBand
          title="Talk to sales about your specific rollout"
          description="Tell us how many locations and departments you're standardizing and we'll recommend a starting plan."
          primary={{ label: "Request a demo", href: "/request-demo" }}
          secondary={{ label: "Start free trial", href: "/start-trial" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
