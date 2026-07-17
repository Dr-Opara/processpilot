import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Alert } from "@/components/ui/Alert";

export function LegalContent({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}) {
  return (
    <Section className="py-16 sm:py-20">
      <Container className="max-w-3xl">
        <Stack className="gap-8">
          <Stack className="gap-3">
            <Heading as="h1" className="font-serif text-4xl">
              {title}
            </Heading>
            <Text className="text-sm text-muted">Last updated {updated}</Text>
            <Text className="text-muted">{intro}</Text>
          </Stack>

          <Alert
            title="Draft policy"
            description="ProcessPilot is in early development. This is a working draft, not a final legal document, and will be reviewed by counsel before general availability."
          />

          <Stack className="gap-8">
            {sections.map((section) => (
              <Stack key={section.heading} className="gap-3">
                <Heading as="h2">{section.heading}</Heading>
                {section.body.map((paragraph, index) => (
                  <Text key={index} className="text-muted">
                    {paragraph}
                  </Text>
                ))}
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Section>
  );
}
