import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PageHero } from "@/components/marketing/sections/PageHero";
import { RelatedLinks } from "@/components/marketing/sections/RelatedLinks";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { Alert } from "@/components/ui/Alert";
import { Container } from "@/components/ui/Layout";
import { primaryNav } from "@/content/site";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Industries",
  description:
    "How property management, healthcare operations, professional services, logistics, and franchise organizations use ProcessPilot.",
  path: "/industries",
});

export default function IndustriesOverviewPage() {
  const industryLinks = primaryNav[2].items.map((item) => ({
    label: item.label,
    href: item.href,
    description: item.description ?? "",
  }));

  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <PageHero
          eyebrow="Industries"
          headline="Operational structure that fits how your industry actually runs"
          intro="The core platform is the same everywhere. What changes is which workflows, roles, and templates fit your operation."
          accent="cobalt"
          primary={{ label: "Request a demo", href: "/request-demo" }}
          secondary={{ label: "Start free trial", href: "/start-trial" }}
        />
        <Container className="pb-4">
          <Alert
            title="Operational software, not a compliance guarantee"
            description="ProcessPilot standardizes how work happens. It does not provide legal, medical, or regulatory compliance certification for any industry."
          />
        </Container>
        <RelatedLinks title="Find your industry" links={industryLinks} />
        <CtaBand
          title="Don't see your industry?"
          description="ProcessPilot's workflow model applies to most operational, service, and multi-location businesses."
          primary={{ label: "Talk to us", href: "/request-demo" }}
          secondary={{ label: "See the platform", href: "/product" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
