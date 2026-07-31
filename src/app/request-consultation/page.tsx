import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { RequestConsultationForm } from "@/components/marketing/forms/RequestConsultationForm";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text, Eyebrow } from "@/components/ui/Typography";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Discuss a project",
  description:
    "Tell us about your AI, cybersecurity, or compliance and governance project. This is a professional-services inquiry, separate from the ProcessPilot SaaS product.",
  path: "/request-consultation",
});

export default function RequestConsultationPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <Section className="py-16 sm:py-20">
          <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <Stack className="gap-4">
              <Eyebrow>Professional services</Eyebrow>
              <Heading as="h1" className="font-serif text-4xl">
                Discuss a project
              </Heading>
              <Text className="text-muted">
                Tell us about your AI, cybersecurity, or compliance and governance project. This is
                an independent professional-services inquiry — separate from the ProcessPilot SaaS
                product and its own trial/demo flow.
              </Text>
              <Text className="text-sm text-muted">
                This form runs in development mode: submissions are validated but not stored, and no
                email is sent yet.
              </Text>
            </Stack>
            <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-soft sm:p-8">
              <RequestConsultationForm />
            </div>
          </Container>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
