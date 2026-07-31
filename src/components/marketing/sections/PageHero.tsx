import { clsx } from "clsx";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text, Eyebrow } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import type { CtaLink } from "@/content/types";

// "signal" (color-signal, #F05A34) is deliberately not offered here —
// at Eyebrow's text-xs/uppercase size, it fails WCAG AA color-contrast
// (3.1:1 against the paper background, below the 4.5:1 normal-text
// minimum) even though it's fine at the larger sizes/UI components
// design/colors.md documents it for.
const accentText: Record<string, string> = {
  cobalt: "text-cobalt",
  success: "text-success",
  warning: "text-warning",
};

export function PageHero({
  eyebrow,
  headline,
  intro,
  accent = "cobalt",
  primary,
  secondary,
  className,
}: {
  eyebrow: string;
  headline: string;
  intro: string;
  accent?: "cobalt" | "success" | "warning";
  primary?: CtaLink;
  secondary?: CtaLink;
  className?: string;
}) {
  return (
    <Section className={clsx("border-b border-border/70", className)}>
      <Container className="py-16 sm:py-20">
        <Stack className="max-w-3xl gap-5">
          <Eyebrow className={accentText[accent]}>{eyebrow}</Eyebrow>
          <Heading as="h1" className="font-serif text-4xl sm:text-5xl">
            {headline}
          </Heading>
          <Text className="text-lg text-muted">{intro}</Text>
          {primary || secondary ? (
            <div className="flex flex-wrap gap-3 pt-2">
              {primary ? (
                <Button href={primary.href} variant={primary.variant ?? "primary"}>
                  {primary.label}
                </Button>
              ) : null}
              {secondary ? (
                <Button href={secondary.href} variant={secondary.variant ?? "secondary"}>
                  {secondary.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </Stack>
      </Container>
    </Section>
  );
}
