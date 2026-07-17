import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PageHero } from "@/components/marketing/sections/PageHero";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  securityControls,
  certificationDisclaimer,
  securityContactEmail,
} from "@/content/security";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Security",
  description:
    "How ProcessPilot is designed to handle tenant isolation, access control, encryption, and evidence storage.",
  path: "/security",
});

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <PageHero
          eyebrow="Security"
          headline="Security is a design principle, stated plainly"
          intro="ProcessPilot is early in development. This page describes how the product is designed to handle access, isolation, and evidence — not audited or certified claims."
          accent="warning"
        />

        <Container className="pb-4">
          <Alert title="No certifications claimed" description={certificationDisclaimer} />
        </Container>

        <Section className="py-14 sm:py-16">
          <Container>
            <Stack className="gap-6">
              <Heading as="h2">Planned and in-progress controls</Heading>
              <div className="grid gap-6 sm:grid-cols-2">
                {securityControls.map((control) => (
                  <Stack
                    key={control.title}
                    className="gap-2 rounded-2xl border border-border bg-surface p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Text className="font-semibold text-ink">{control.title}</Text>
                      <StatusBadge status="warning">{control.status}</StatusBadge>
                    </div>
                    <Text className="text-sm text-muted">{control.description}</Text>
                  </Stack>
                ))}
              </div>
            </Stack>
          </Container>
        </Section>

        <Section className="border-t border-border/70 bg-[#fcfbf8] py-14 sm:py-16">
          <Container>
            <Stack className="max-w-2xl gap-4">
              <Heading as="h2">Report a security concern</Heading>
              <Text className="text-muted">
                If you believe you&apos;ve found a security issue, contact us directly rather than
                filing a public report.
              </Text>
              <a
                href={`mailto:${securityContactEmail}`}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink hover:border-cobalt"
              >
                <Mail size={16} aria-hidden="true" />
                {securityContactEmail}
              </a>
            </Stack>
          </Container>
        </Section>

        <CtaBand
          title="Questions about a specific control?"
          description="Enterprise plans can include custom data retention terms and additional access controls."
          primary={{ label: "Request a demo", href: "/request-demo" }}
          secondary={{ label: "See pricing", href: "/pricing" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
