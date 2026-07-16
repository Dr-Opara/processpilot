import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Button } from "@/components/ui/Button";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Badge } from "@/components/ui/Badge";
import { Metric } from "@/components/ui/Metric";
import { ProductPreviewFrame } from "@/components/marketing/ProductPreviewFrame";

export default function Home() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <Section className="border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(247,245,240,1))]">
          <Container className="grid gap-10 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <Stack className="max-w-2xl gap-6">
              <Badge>Phase 1 foundation</Badge>
              <Heading
                as="h1"
                className="max-w-xl font-serif text-5xl leading-tight sm:text-6xl"
              >
                Calm operations for teams that need to move without chaos.
              </Heading>
              <Text className="max-w-xl text-lg text-muted">
                ProcessPilot gives operators a predictable canvas for
                onboarding, approvals, and work rituals without the noise of
                generic AI tools.
              </Text>
              <div className="flex flex-wrap gap-3">
                <Button>Request a demo</Button>
                <Button variant="secondary">Explore the system</Button>
              </div>
            </Stack>
            <ProductPreviewFrame />
          </Container>
        </Section>

        <Section>
          <Container className="grid gap-6 py-16 md:grid-cols-3">
            <Metric label="Repeatable playbooks" value="24/7" />
            <Metric label="Shared visibility" value="3 views" />
            <Metric label="Human approvals" value="Instant" />
          </Container>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
