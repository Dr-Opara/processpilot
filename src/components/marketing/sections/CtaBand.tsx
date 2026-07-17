import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import type { CtaLink } from "@/content/types";

export function CtaBand({
  title,
  description,
  primary,
  secondary,
}: {
  title: string;
  description: string;
  primary: CtaLink;
  secondary: CtaLink;
}) {
  return (
    <Section className="border-t border-border/70 bg-ink py-16">
      <Container>
        <Stack className="items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Stack className="max-w-xl gap-2">
            <Heading as="h2" className="text-surface">
              {title}
            </Heading>
            <Text className="text-surface/70">{description}</Text>
          </Stack>
          <div className="flex flex-wrap gap-3">
            <Button href={primary.href} variant="onDark">
              {primary.label}
            </Button>
            <Button href={secondary.href} variant="outlineOnDark">
              {secondary.label}
            </Button>
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
