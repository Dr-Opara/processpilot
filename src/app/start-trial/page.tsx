import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { StartTrialForm } from "@/components/marketing/forms/StartTrialForm";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text, Eyebrow } from "@/components/ui/Typography";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Start free trial",
  description: "Create a ProcessPilot workspace and publish your first workflow.",
  path: "/start-trial",
});

export default function StartTrialPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <Section className="py-16 sm:py-20">
          <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <Stack className="gap-4">
              <Eyebrow>Start free trial</Eyebrow>
              <Heading as="h1" className="font-serif text-4xl">
                Publish your first workflow
              </Heading>
              <Text className="text-muted">
                Create a workspace, then import your first policy or SOP and see it become a draft
                workflow.
              </Text>
              <Text className="text-sm text-muted">
                This form runs in development mode: signups are validated but no account is created,
                no password is stored, and no email is sent yet.
              </Text>
            </Stack>
            <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-soft sm:p-8">
              <StartTrialForm />
            </div>
          </Container>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
