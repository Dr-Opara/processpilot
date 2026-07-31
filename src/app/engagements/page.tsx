import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PageHero } from "@/components/marketing/sections/PageHero";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { Alert } from "@/components/ui/Alert";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Client Engagements",
  description:
    "Selected independent project engagements in AI, cybersecurity, compliance, and federal program readiness, delivered separately from the ProcessPilot SaaS product.",
  path: "/engagements",
});

/**
 * Phase 31 builds this section's structure; Phase 31A adds the actual
 * named-engagement content (classified by relationship type, gated on
 * publication approval — see src/content/legal.ts's
 * ClientRelationshipType). Deliberately no engagement entries here yet:
 * fabricating client details ahead of that phase's verification work
 * would violate the same "never claim what isn't verified" posture
 * every other phase in this codebase follows.
 */
export default function ClientEngagementsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <PageHero
          eyebrow="Client Engagements"
          headline="Selected independent project engagements"
          intro="In addition to delivering our SaaS products, ProcessPilot Technologies supports selected organizations through independent project engagements in AI, cybersecurity, compliance, and federal program readiness."
          accent="cobalt"
          primary={{ label: "Discuss a project", href: "/request-consultation" }}
          secondary={{ label: "See professional services", href: "/services" }}
        />
        <Container className="-mt-4 pb-10">
          <Alert
            title="Not SaaS customers unless stated"
            description="An independent project engagement does not, by itself, indicate use of the ProcessPilot SaaS platform. Each engagement listed here (once published) is classified by relationship type — independent contract engagement, professional-services client, and/or SaaS customer — never assumed."
          />
        </Container>
        <Section className="py-14 sm:py-16">
          <Container>
            <Stack className="max-w-2xl gap-4">
              <Heading as="h2">Engagement profiles</Heading>
              <Text className="text-muted">
                Named client engagement profiles are published only with the client&apos;s
                publication approval, per our publication-approval process. Profiles are currently
                in preparation.
              </Text>
            </Stack>
          </Container>
        </Section>
        <CtaBand
          title="Interested in an independent engagement?"
          description="Tell us about the project and we'll follow up to discuss fit and scope."
          primary={{ label: "Discuss a project", href: "/request-consultation" }}
          secondary={{ label: "Explore ProcessPilot", href: "/product" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
