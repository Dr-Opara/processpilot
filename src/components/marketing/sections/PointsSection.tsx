import { clsx } from "clsx";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";

export function PointsSection({
  title,
  description,
  points,
  variant = "list",
  className,
}: {
  title: string;
  description?: string;
  points: string[];
  variant?: "list" | "cards";
  className?: string;
}) {
  return (
    <Section className={clsx("py-14 sm:py-16", className)}>
      <Container>
        <Stack className="gap-6">
          <Stack className="max-w-2xl gap-3">
            <Heading as="h2">{title}</Heading>
            {description ? (
              <Text className="text-muted">{description}</Text>
            ) : null}
          </Stack>
          {variant === "cards" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {points.map((point) => (
                <div
                  key={point}
                  className="rounded-2xl border border-border bg-surface p-5"
                >
                  <Text className="text-sm text-ink">{point}</Text>
                </div>
              ))}
            </div>
          ) : (
            <ul className="grid gap-3 border-t border-border/70 pt-6 sm:grid-cols-2">
              {points.map((point) => (
                <li
                  key={point}
                  className="flex gap-3 text-sm leading-6 text-muted"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cobalt"
                  />
                  {point}
                </li>
              ))}
            </ul>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
