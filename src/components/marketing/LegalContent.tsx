import { Container, Section, Stack, Cluster } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { LegalDocumentStatus } from "@/content/legal";
import { statusLabel } from "@/content/legal";

export function LegalContent({
  title,
  updated,
  version,
  status,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  version?: string;
  status?: LegalDocumentStatus;
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
            <Cluster className="items-center gap-3">
              <Text className="text-sm text-muted">
                Last updated {updated}
                {version ? ` · v${version}` : ""}
              </Text>
              {status && (
                <StatusBadge status={status === "approved" ? "success" : "warning"}>
                  {statusLabel(status)}
                </StatusBadge>
              )}
            </Cluster>
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
