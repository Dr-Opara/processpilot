import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { productPillars } from "@/content/site";

export function PillarsGrid() {
  return (
    <Section className="py-16 sm:py-20">
      <Container>
        <Stack className="gap-10">
          <Stack className="max-w-2xl gap-3">
            <Heading as="h2">Four product pillars</Heading>
            <Text className="text-muted">
              Everything in ProcessPilot supports one of these four jobs.
            </Text>
          </Stack>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {productPillars.map((pillar) => (
              <a
                key={pillar.title}
                href={pillar.href}
                className="group flex flex-col gap-3 bg-surface p-6 transition-colors hover:bg-paper"
              >
                <Text className="font-semibold text-ink group-hover:text-cobalt">
                  {pillar.title}
                </Text>
                <Text className="text-sm text-muted">{pillar.description}</Text>
              </a>
            ))}
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
