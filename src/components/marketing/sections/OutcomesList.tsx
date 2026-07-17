import { Check } from "lucide-react";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading } from "@/components/ui/Typography";

export function OutcomesList({ title, outcomes }: { title: string; outcomes: string[] }) {
  return (
    <Section className="border-t border-border/70 py-14 sm:py-16">
      <Container>
        <Stack className="gap-6">
          <Heading as="h2">{title}</Heading>
          <ul className="grid gap-3 sm:grid-cols-2">
            {outcomes.map((outcome) => (
              <li key={outcome} className="flex items-start gap-3 text-sm text-muted">
                <Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                {outcome}
              </li>
            ))}
          </ul>
        </Stack>
      </Container>
    </Section>
  );
}
