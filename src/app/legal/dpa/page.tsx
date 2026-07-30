import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Alert } from "@/components/ui/Alert";
import { buildMetadata } from "@/lib/seo";
import { LEGAL_DOCUMENTS } from "@/content/legal";

const doc = LEGAL_DOCUMENTS.dpa;

export const metadata: Metadata = buildMetadata({
  title: doc.title,
  description: "Data Processing Addendum template for customers who require one.",
  path: doc.path,
});

const sections = [
  {
    heading: "Scope",
    body: [
      "This template describes the terms that would govern ProcessPilot's processing of personal data on a customer's behalf, for customers whose own compliance obligations require a signed Data Processing Addendum (DPA).",
    ],
  },
  {
    heading: "Roles",
    body: [
      "Customer acts as the data controller (or business, under applicable law) for personal data submitted to ProcessPilot. ProcessPilot Technologies acts as the data processor (or service provider).",
    ],
  },
  {
    heading: "Subprocessors",
    body: [
      "ProcessPilot's current subprocessors are listed on the Subprocessors page. A signed DPA would include a commitment to notify customers of material changes to this list, per the terms negotiated in that agreement.",
    ],
  },
  {
    heading: "Security measures",
    body: [
      "Organization-level tenant isolation (application- and database-layer), encrypted storage of third-party credentials, role-based access control, and immutable audit logging — see the Security page for detail on how these are implemented.",
    ],
  },
  {
    heading: "International transfers",
    body: [
      "ProcessPilot's infrastructure is currently hosted in the United States (see Subprocessors). Standard Contractual Clauses or another applicable transfer mechanism would be incorporated into the executed DPA if required for a specific customer relationship.",
    ],
  },
  {
    heading: "How to request an executed DPA",
    body: [
      "This page is a template, not an executable or binding document. To request a DPA specific to your organization, contact legal@processpilot.com — a signed agreement requires review by both parties' counsel.",
    ],
  },
];

export default function DpaPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <Section className="py-16 sm:py-20">
          <Container className="max-w-3xl">
            <Stack className="gap-8">
              <Stack className="gap-3">
                <Heading as="h1" className="font-serif text-4xl">
                  {doc.title}
                </Heading>
                <Text className="text-sm text-muted">
                  Last updated {doc.effectiveDate} · v{doc.version}
                </Text>
                <Text className="text-muted">
                  A template describing the terms available to customers who require a signed Data
                  Processing Addendum.
                </Text>
              </Stack>

              <Alert
                title="Template — not an executed agreement"
                description="This page is a non-binding template requiring attorney review and mutual execution before it takes effect for any specific customer. It is not itself a signed DPA."
              />

              <Stack className="gap-8">
                {sections.map((section) => (
                  <Stack key={section.heading} className="gap-3">
                    <Heading as="h2">{section.heading}</Heading>
                    {section.body.map((paragraph, index) => (
                      <Text key={index} className="text-muted">
                        {paragraph}
                      </Text>
                    ))}
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Container>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
