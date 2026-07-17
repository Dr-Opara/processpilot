import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Badge } from "@/components/ui/Badge";
import type { WorkflowStep } from "@/content/types";

export function WorkflowSteps({
  title,
  steps,
  company,
}: {
  title: string;
  steps: WorkflowStep[];
  company?: string;
}) {
  return (
    <Section className="border-t border-border/70 py-14 sm:py-16">
      <Container>
        <Stack className="gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Heading as="h2">{title}</Heading>
            {company ? (
              <Badge className="border-cobalt/30 bg-cobalt/5 text-cobalt">
                Product demonstration · {company}
              </Badge>
            ) : null}
          </div>
          <ol className="grid gap-4 border-t border-border/70 pt-6 sm:grid-cols-2">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface">
                  {index + 1}
                </span>
                <div>
                  <Text className="font-semibold text-ink">{step.title}</Text>
                  <Text className="mt-1 text-sm text-muted">{step.description}</Text>
                </div>
              </li>
            ))}
          </ol>
        </Stack>
      </Container>
    </Section>
  );
}
