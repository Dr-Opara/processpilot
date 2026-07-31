import { PageHero } from "@/components/marketing/sections/PageHero";
import { CapabilitiesGrid } from "@/components/marketing/sections/CapabilitiesGrid";
import { RelatedLinks } from "@/components/marketing/sections/RelatedLinks";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { Alert } from "@/components/ui/Alert";
import { Container } from "@/components/ui/Layout";
import type { ServicePageContent } from "@/content/types";

/**
 * Phase 31: renders a professional-services page — visually related to
 * ProductPageTemplate/SolutionPageTemplate (same PageHero/CapabilitiesGrid/
 * CtaBand building blocks) but never uses product CTAs ("Start free
 * trial") or product-only sections (workflow steps, template
 * galleries). The `disclaimer` Alert makes the SaaS-vs-services
 * distinction explicit on every page, not just implicit from copy.
 */
export function ServicePageTemplate({ content }: { content: ServicePageContent }) {
  return (
    <>
      <PageHero
        eyebrow={content.eyebrow}
        headline={content.headline}
        intro={content.intro}
        accent={content.accent}
        primary={{ label: "Discuss a project", href: "/request-consultation" }}
        secondary={{ label: "Explore ProcessPilot", href: "/product" }}
      />
      <Container className="-mt-4 pb-10">
        <Alert
          title="An independent professional-services engagement"
          description={content.disclaimer}
        />
      </Container>
      <CapabilitiesGrid title="What this engagement covers" items={content.offerings} />
      <CapabilitiesGrid title="How we engage" items={content.engagementModel} />
      <RelatedLinks title="Related services" links={content.related} />
      <CtaBand
        title={content.cta.title}
        description={content.cta.description}
        primary={content.cta.primary}
        secondary={content.cta.secondary}
      />
    </>
  );
}
