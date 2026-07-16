import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";

export function CapabilitiesGrid({
  title,
  items,
}: {
  title: string;
  items: { title: string; description: string }[];
}) {
  return (
    <Section className="border-t border-border/70 py-14 sm:py-16">
      <Container>
        <Stack className="gap-6">
          <Heading as="h2">{title}</Heading>
          <div className="grid gap-6 border-t border-border/70 pt-6 sm:grid-cols-2">
            {items.map((item) => (
              <Stack key={item.title} className="gap-2">
                <Text className="font-semibold text-ink">{item.title}</Text>
                <Text className="text-sm text-muted">{item.description}</Text>
              </Stack>
            ))}
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
