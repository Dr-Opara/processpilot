import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SignInForm } from "@/components/marketing/forms/SignInForm";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text, Eyebrow } from "@/components/ui/Typography";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Sign in",
  description: "Sign in to your ProcessPilot workspace.",
  path: "/sign-in",
  noIndex: true,
});

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <Section className="py-16 sm:py-20">
          <Container className="mx-auto max-w-md">
            <Stack className="gap-6">
              <Stack className="gap-2">
                <Eyebrow>Sign in</Eyebrow>
                <Heading as="h1" className="font-serif text-3xl">
                  Welcome back
                </Heading>
                <Text className="text-sm text-muted">
                  Authentication is not implemented yet. This form runs in
                  development mode and validates input only.
                </Text>
              </Stack>
              <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-soft sm:p-8">
                <SignInForm />
              </div>
            </Stack>
          </Container>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
