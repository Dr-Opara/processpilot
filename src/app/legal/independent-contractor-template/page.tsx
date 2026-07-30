import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Alert } from "@/components/ui/Alert";
import { buildMetadata } from "@/lib/seo";
import { LEGAL_DOCUMENTS } from "@/content/legal";

const doc = LEGAL_DOCUMENTS.independentContractor;

export const metadata: Metadata = buildMetadata({
  title: doc.title,
  description: "Structure used for independent contract engagements.",
  path: doc.path,
});

const fields = [
  "Engaging organization and engagement classification: Independent Contract Project",
  "Engagement summary and objective",
  "Services to be performed",
  "Term and expected duration",
  "Compensation and invoicing terms",
  "Confidentiality (per the Professional Services Terms)",
  "Publication/case-study approval — default: no publication without written approval",
  "Independent-contractor status: this engagement does not create an employment, partnership, joint-venture, or SaaS-subscription relationship",
  "Termination terms",
  "Signatures and effective date",
];

export default function IndependentContractorTemplatePage() {
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
                  The structure ProcessPilot Technologies uses for a bounded, project-specific
                  independent contract engagement — distinct from a ProcessPilot SaaS subscription
                  or a broader professional-services relationship.
                </Text>
              </Stack>

              <Alert
                title="Template — not an executed agreement"
                description="This is a non-binding outline, not a fillable contract. A real engagement letter is drafted and signed separately, incorporating the Professional Services Terms by reference."
              />

              <Stack className="gap-3">
                <Heading as="h2">What an engagement letter covers</Heading>
                <ul className="list-disc space-y-2 pl-5 text-muted">
                  {fields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </Stack>

              <Text className="text-sm text-muted">
                To discuss an independent contract engagement, contact services@processpilot.com.
              </Text>
            </Stack>
          </Container>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
