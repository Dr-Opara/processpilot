import type { Metadata, Route } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PageHero } from "@/components/marketing/sections/PageHero";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { buildMetadata } from "@/lib/seo";
import { certificationDisclaimer } from "@/content/security";

export const metadata: Metadata = buildMetadata({
  title: "Trust Center",
  description: "Security, privacy, and legal information for ProcessPilot, in one place.",
  path: "/trust",
});

const links: { title: string; description: string; href: Route }[] = [
  {
    title: "Security",
    description:
      "What's implemented, partial, and planned — tenant isolation, encryption, audit logging, and more.",
    href: "/security",
  },
  {
    title: "Privacy Policy",
    description: "What we collect, how it's used, and how to exercise your rights.",
    href: "/privacy",
  },
  {
    title: "Terms of Service",
    description: "Terms governing use of the ProcessPilot application and website.",
    href: "/terms",
  },
  {
    title: "Acceptable Use Policy",
    description: "What is and isn't allowed when using ProcessPilot.",
    href: "/legal/acceptable-use",
  },
  {
    title: "Subprocessors",
    description: "Third-party services used to operate ProcessPilot.",
    href: "/legal/subprocessors",
  },
  {
    title: "SaaS Data Processing Addendum",
    description: "Template terms for ProcessPilot SaaS customers who require a signed DPA.",
    href: "/legal/dpa",
  },
  {
    title: "Professional Services Terms",
    description:
      "Terms for AI, cybersecurity, compliance, and custom project engagements — separate from the SaaS terms.",
    href: "/legal/professional-services-terms",
  },
];

export default function TrustPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <PageHero
          eyebrow="Trust Center"
          headline="Security, privacy, and legal — in one place"
          intro="Everything about how ProcessPilot handles your organization's data, all in one place. No certification or independent-audit claims here — just what's actually built."
        />

        <Section className="py-14 sm:py-16">
          <Container>
            <div className="grid gap-6 sm:grid-cols-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl border border-border bg-surface p-5 hover:border-cobalt"
                >
                  <Stack className="gap-2">
                    <Heading as="h2" className="text-lg">
                      {link.title}
                    </Heading>
                    <Text className="text-sm text-muted">{link.description}</Text>
                  </Stack>
                </Link>
              ))}
            </div>
          </Container>
        </Section>

        <Section className="border-t border-border/70 bg-[#fcfbf8] py-14 sm:py-16">
          <Container>
            <Stack className="max-w-2xl gap-3">
              <Heading as="h2">Certifications</Heading>
              <Text className="text-muted">{certificationDisclaimer}</Text>
            </Stack>
          </Container>
        </Section>

        <CtaBand
          title="Have a specific compliance question?"
          description="Reach out and we'll answer directly, or route your question to the right document above."
          primary={{ label: "Request a demo", href: "/request-demo" }}
          secondary={{ label: "Contact security", href: "/security" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
