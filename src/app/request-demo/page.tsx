import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { RequestDemoForm } from "@/components/marketing/forms/RequestDemoForm";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text, Eyebrow } from "@/components/ui/Typography";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Request a demo",
  description:
    "Walk through ProcessPilot with your own process. Tell us about your team and we'll follow up.",
  path: "/request-demo",
});

export default function RequestDemoPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <Section className="py-16 sm:py-20">
          <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <Stack className="gap-4">
              <Eyebrow>Request a demo</Eyebrow>
              <Heading as="h1" className="font-serif text-4xl">
                See ProcessPilot with your own process
              </Heading>
              <Text className="text-muted">
                Tell us a bit about your team. We&apos;ll follow up to schedule
                a walkthrough tailored to the process you want to standardize
                first.
              </Text>
              <Text className="text-sm text-muted">
                This form runs in development mode: submissions are validated
                but not stored, and no email is sent yet.
              </Text>
            </Stack>
            <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-soft sm:p-8">
              <RequestDemoForm />
            </div>
          </Container>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
