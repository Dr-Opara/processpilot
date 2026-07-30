import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Alert } from "@/components/ui/Alert";
import { buildMetadata } from "@/lib/seo";
import { LEGAL_DOCUMENTS, subprocessors } from "@/content/legal";

const doc = LEGAL_DOCUMENTS.subprocessors;

export const metadata: Metadata = buildMetadata({
  title: doc.title,
  description: "Third-party subprocessors used to operate ProcessPilot.",
  path: doc.path,
});

export default function SubprocessorsPage() {
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
                  Third-party services ProcessPilot uses to operate the product. This list reflects
                  what&apos;s actually integrated in the codebase today, not a fixed or
                  comprehensive vendor list — we&apos;ll update it as that changes.
                </Text>
              </Stack>

              <Alert
                title="Notice of changes"
                description="We'll update this page when we add or remove a subprocessor. Customers with a Data Processing Addendum in place may be entitled to advance notice per that agreement."
              />

              <Stack className="gap-4">
                {subprocessors.map((sp) => (
                  <Stack key={sp.name} className="gap-1 rounded-md border border-border p-4">
                    <Heading as="h2" className="text-lg">
                      {sp.name}
                    </Heading>
                    <Text className="text-muted">{sp.purpose}</Text>
                    <Text className="text-sm text-muted">
                      Location: {sp.location} · Data categories: {sp.dataCategories.join(", ")}
                    </Text>
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
