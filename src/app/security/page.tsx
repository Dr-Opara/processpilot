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
          intro="This page describes how ProcessPilot actually handles access, isolation, and evidence today — implemented controls, partial controls, and what's still planned, each labeled honestly. Not an audited or certified claim."
          accent="warning"
        />

        <Container className="pb-4">
          <Alert title="No certifications claimed" description={certificationDisclaimer} />
        </Container>

        <Section className="py-14 sm:py-16">
          <Container>
            <Stack className="gap-6">
              <Heading as="h2">Security controls</Heading>
              <div className="grid gap-6 sm:grid-cols-2">
                {securityControls.map((control) => (
                  <Stack
                    key={control.title}
                    className="gap-2 rounded-2xl border border-border bg-surface p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Text className="font-semibold text-ink">{control.title}</Text>
                      <StatusBadge
                        status={
                          control.status === "Implemented"
                            ? "success"
                            : control.status === "Partial"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {control.status}
                      </StatusBadge>
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
                If you believe you&apos;ve found a security vulnerability, please report it
                privately — email us directly or use{" "}
                <a
                  href="https://github.com/Dr-Opara/processpilot/security/advisories/new"
                  className="text-cobalt"
                >
                  GitHub&apos;s private vulnerability reporting
                </a>{" "}
                rather than filing a public issue. Please include a description of the vulnerability
                and its potential impact, steps to reproduce or a proof of concept, and any relevant
                logs with secrets and credentials redacted. We aim to acknowledge reports within a
                few business days. Good-faith security research conducted against your own
                account/organization, without accessing another organization&apos;s data, will not
                be treated as a violation of our{" "}
                <a href="/legal/acceptable-use" className="text-cobalt">
                  Acceptable Use Policy
                </a>
                .
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
