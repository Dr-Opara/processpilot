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
  title: "Professional Services",
  description:
    "Independent AI, cybersecurity, and compliance/governance engagements from ProcessPilot Technologies, delivered separately from the ProcessPilot SaaS product.",
  path: "/services",
});

export default function ProfessionalServicesOverviewPage() {
  const serviceLinks = primaryNav[3].items.map((item) => ({
    label: item.label,
    href: item.href,
    description: item.description ?? "",
  }));

  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <PageHero
          eyebrow="Professional Services"
          headline="Specialized engagements, independent of the ProcessPilot SaaS product"
          intro="ProcessPilot Technologies builds secure, AI-powered SaaS products that help organizations manage workflows, knowledge, compliance, training, and operational performance. We also support selected clients through specialized AI, cybersecurity, governance, and federal-program engagements."
          accent="cobalt"
          primary={{ label: "Discuss a project", href: "/request-consultation" }}
          secondary={{ label: "Explore ProcessPilot", href: "/product" }}
        />
        <Container className="-mt-4 pb-10">
          <Alert
            title="Independent from the SaaS product"
            description="These are professional-services engagements sold and delivered under their own Statement of Work and Professional Services Terms — not a feature of any ProcessPilot subscription plan, and a services engagement does not by itself indicate SaaS product usage."
          />
        </Container>
        <RelatedLinks title="Service areas" links={serviceLinks} />
        <CtaBand
          title="Tell us about your project"
          description="We'll follow up to discuss fit and scope before any engagement begins."
          primary={{ label: "Discuss a project", href: "/request-consultation" }}
          secondary={{ label: "See client engagements", href: "/engagements" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
