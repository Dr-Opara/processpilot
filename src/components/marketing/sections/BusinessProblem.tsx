import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";

const problems = [
  {
    title: "Procedures live in documents nobody opens",
    description:
      "SOPs sit in shared drives as static PDFs. Employees ask a coworker instead of checking the document, so the document drifts further from reality.",
  },
  {
    title: "Execution is inconsistent across people and locations",
    description:
      "The same process runs differently depending on who is doing it and which location they're in, and there's no shared record of which version is correct.",
  },
  {
    title: "Evidence is scattered when it's needed most",
    description:
      "Approvals live in email, uploads live in shared folders, and sign-offs live in someone's memory — until an audit or an incident asks for all of it at once.",
  },
];

export function BusinessProblem() {
  return (
    <Section className="py-16 sm:py-20">
      <Container>
        <Stack className="gap-10">
          <Stack className="max-w-2xl gap-3">
            <Heading as="h2">
              Procedures and execution have drifted apart
            </Heading>
            <Text className="text-muted">
              Most companies have written down how work is supposed to happen.
              Far fewer have a reliable way to make sure it happens that way.
            </Text>
          </Stack>
          <div className="grid gap-6 border-t border-border/70 pt-8 md:grid-cols-3">
            {problems.map((problem) => (
              <Stack key={problem.title} className="gap-2">
                <Text className="font-semibold text-ink">{problem.title}</Text>
                <Text className="text-sm text-muted">
                  {problem.description}
                </Text>
              </Stack>
            ))}
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
