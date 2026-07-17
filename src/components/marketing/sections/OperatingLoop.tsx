import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { operatingLoop } from "@/content/site";

export function OperatingLoop() {
  return (
    <Section className="border-t border-border/70 bg-[#fcfbf8] py-16 sm:py-20">
      <Container>
        <Stack className="gap-10">
          <Stack className="max-w-2xl gap-3">
            <Heading as="h2">A six-stage operating loop</Heading>
            <Text className="text-muted">
              ProcessPilot is built around one repeating loop, not a set of disconnected features.
            </Text>
          </Stack>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {operatingLoop.map((stage, index) => (
              <li
                key={stage.title}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt">
                  Stage {index + 1}
                </span>
                <Text className="font-semibold text-ink">{stage.title}</Text>
                <Text className="text-sm text-muted">{stage.description}</Text>
              </li>
            ))}
          </ol>
        </Stack>
      </Container>
    </Section>
  );
}
