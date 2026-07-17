import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PageHero } from "@/components/marketing/sections/PageHero";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { glossary, resourceCategories } from "@/content/resources";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Resources",
  description:
    "Terminology, implementation guides, and workflow templates for teams building with ProcessPilot.",
  path: "/resources",
});

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <PageHero
          eyebrow="Resources"
          headline="Reference material for building your first workflow"
          intro="A working glossary of terms used across the platform, with implementation guides and templates being added over time."
          accent="cobalt"
        />

        <Section className="py-14 sm:py-16">
          <Container>
            <Stack className="gap-6">
              <Heading as="h2">Resource categories</Heading>
              <div className="grid gap-4 sm:grid-cols-3">
                {resourceCategories.map((category) => (
                  <Stack
                    key={category.title}
                    className="gap-2 rounded-2xl border border-border bg-surface p-5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Text className="font-semibold text-ink">{category.title}</Text>
                      <StatusBadge status={category.status === "Available" ? "success" : "neutral"}>
                        {category.status}
                      </StatusBadge>
                    </div>
                    <Text className="text-sm text-muted">{category.description}</Text>
                  </Stack>
                ))}
              </div>
            </Stack>
          </Container>
        </Section>

        <Section className="border-t border-border/70 bg-[#fcfbf8] py-14 sm:py-16">
          <Container>
            <Stack className="gap-6">
              <Heading as="h2">Terminology glossary</Heading>
              <dl className="grid gap-6 border-t border-border/70 pt-6 sm:grid-cols-2">
                {glossary.map((entry) => (
                  <div key={entry.term} className="flex flex-col gap-1">
                    <dt className="text-sm font-semibold text-ink">{entry.term}</dt>
                    <dd className="text-sm text-muted">{entry.definition}</dd>
                  </div>
                ))}
              </dl>
            </Stack>
          </Container>
        </Section>

        <CtaBand
          title="Want a guide on something specific?"
          description="Tell us what you're trying to standardize and we'll point you to the closest example."
          primary={{ label: "Request a demo", href: "/request-demo" }}
          secondary={{ label: "Start free trial", href: "/start-trial" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
