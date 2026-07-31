import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PageHero } from "@/components/marketing/sections/PageHero";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Company",
  description:
    "Why ProcessPilot exists and what we believe about the gap between written procedures and how work actually happens.",
  path: "/company",
});

const values = [
  {
    title: "Procedures should be usable, not just written",
    description:
      "A policy that nobody follows isn't a policy — it's a document. We build for the moment someone actually needs the next step.",
  },
  {
    title: "Evidence should exist because work happened, not for the audit",
    description:
      "Approvals and evidence are a byproduct of doing the work correctly, not a separate task bolted on afterward.",
  },
  {
    title: "People decide, software assists",
    description:
      "AI can draft and suggest. A person reviews and approves before anything reaches someone's task list.",
  },
];

export default function CompanyPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <PageHero
          eyebrow="Company"
          headline="We build for the gap between the SOP and the actual work"
          intro="ProcessPilot started from a simple observation: most companies have written down how work should happen, and far fewer have a reliable way to make sure it happens that way."
          accent="cobalt"
        />

        <Section className="border-b border-border/70 bg-[#fcfbf8] py-10">
          <Container>
            <Text className="max-w-3xl text-lg leading-8 text-ink">
              ProcessPilot Technologies builds secure, AI-powered SaaS products that help
              organizations manage workflows, knowledge, compliance, training, and operational
              performance. We also support selected clients through specialized AI, cybersecurity,
              governance, and federal-program engagements.
            </Text>
          </Container>
        </Section>

        <Section className="py-14 sm:py-16">
          <Container>
            <Stack className="gap-6">
              <Heading as="h2">What we believe</Heading>
              <div className="grid gap-6 border-t border-border/70 pt-6 md:grid-cols-3">
                {values.map((value) => (
                  <Stack key={value.title} className="gap-2">
                    <Text className="font-semibold text-ink">{value.title}</Text>
                    <Text className="text-sm text-muted">{value.description}</Text>
                  </Stack>
                ))}
              </div>
            </Stack>
          </Container>
        </Section>

        <Section className="border-t border-border/70 bg-[#fcfbf8] py-14 sm:py-16">
          <Container>
            <Stack className="max-w-2xl gap-4">
              <Heading as="h2">Where we are today</Heading>
              <Text className="text-muted">
                ProcessPilot is in early development. We&apos;re building the platform in the open
                with the operators, HR leaders, compliance teams, and multi-location operators who
                feel this problem most directly.
              </Text>
              <Text className="text-muted">
                If that sounds like your team, we&apos;d like to hear what your highest-friction
                process is.
              </Text>
            </Stack>
          </Container>
        </Section>

        <Section className="border-t border-border/70 py-14 sm:py-16">
          <Container>
            <Stack className="max-w-2xl gap-4">
              <Heading as="h2">Beyond the product</Heading>
              <Text className="text-muted">
                Alongside ProcessPilot the SaaS product, we take on a small number of independent
                professional-services engagements — AI, cybersecurity, and compliance/governance
                projects — for clients who need that specific expertise, separate from any
                subscription.
              </Text>
              <Text className="text-sm text-muted">
                See{" "}
                <a href="/services" className="text-cobalt underline">
                  Professional Services
                </a>{" "}
                or{" "}
                <a href="/engagements" className="text-cobalt underline">
                  Client Engagements
                </a>
                .
              </Text>
            </Stack>
          </Container>
        </Section>

        <CtaBand
          title="Want to help shape the product?"
          description="Early customers get a direct line to the team building ProcessPilot."
          primary={{ label: "Request a demo", href: "/request-demo" }}
          secondary={{ label: "See the platform", href: "/product" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
