import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Alert } from "@/components/ui/Alert";

const capabilities = [
  {
    title: "Draft workflows from source documents",
    description:
      "Propose tasks, roles, and decision points from an uploaded policy or SOP, as a starting draft — not a finished process.",
  },
  {
    title: "Suggest where a process might break",
    description:
      "Flag steps with unclear ownership or missing approvals based on patterns in similar published workflows.",
  },
  {
    title: "Summarize exception patterns",
    description:
      "Group recurring exceptions so a process owner can see the pattern instead of reading every case individually.",
  },
];

export function AICapabilities() {
  return (
    <Section className="border-t border-border/70 py-16 sm:py-20">
      <Container>
        <Stack className="gap-8">
          <Stack className="max-w-2xl gap-3">
            <Heading as="h2">Where AI assists, and where people decide</Heading>
            <Text className="text-muted">
              ProcessPilot uses AI to speed up drafting and pattern recognition. A person always
              reviews and approves what gets published or acted on.
            </Text>
          </Stack>
          <div className="grid gap-6 md:grid-cols-3">
            {capabilities.map((capability) => (
              <Stack key={capability.title} className="gap-2">
                <Text className="font-semibold text-ink">{capability.title}</Text>
                <Text className="text-sm text-muted">{capability.description}</Text>
              </Stack>
            ))}
          </div>
          <Alert
            title="Human review, by design"
            description="Draft workflows, suggested steps, and exception summaries are proposals. A process owner or manager reviews and approves before anything reaches an employee's task list."
          />
        </Stack>
      </Container>
    </Section>
  );
}
