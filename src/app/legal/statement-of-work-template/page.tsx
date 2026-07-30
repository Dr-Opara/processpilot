import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Alert } from "@/components/ui/Alert";
import { buildMetadata } from "@/lib/seo";
import { LEGAL_DOCUMENTS } from "@/content/legal";

const doc = LEGAL_DOCUMENTS.statementOfWork;

export const metadata: Metadata = buildMetadata({
  title: doc.title,
  description: "Structure used for professional-services Statements of Work.",
  path: doc.path,
});

const fields = [
  "Client legal name and primary contact",
  "Engagement name and relationship type (professional services client / independent contract engagement)",
  "Background and objective",
  "Scope of services (in, and explicitly out of scope)",
  "Deliverables and acceptance criteria",
  "Timeline and milestones",
  "Fees, payment schedule, and expenses",
  "Client-provided resources and dependencies",
  "Confidentiality reference (Professional Services Terms)",
  "Intellectual property terms for this engagement (if different from the default in the Professional Services Terms)",
  "Publication/case-study approval terms specific to this engagement",
  "Term and termination",
  "Signatures and effective date",
];

export default function StatementOfWorkTemplatePage() {
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
                  The structure ProcessPilot Technologies uses to scope a professional-services
                  engagement.
                </Text>
              </Stack>

              <Alert
                title="Template — not an executed agreement"
                description="This is a non-binding outline of what a real Statement of Work covers, not a fillable contract. Every actual engagement's SOW is drafted, negotiated, and signed separately, incorporating the Professional Services Terms by reference."
              />

              <Stack className="gap-3">
                <Heading as="h2">What a Statement of Work covers</Heading>
                <ul className="list-disc space-y-2 pl-5 text-muted">
                  {fields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </Stack>

              <Text className="text-sm text-muted">
                To scope an engagement, contact services@processpilot.com.
              </Text>
            </Stack>
          </Container>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
