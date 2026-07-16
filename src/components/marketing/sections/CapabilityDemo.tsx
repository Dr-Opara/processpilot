import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";

export function CapabilityDemo({
  title,
  description,
  bullets,
  demoTitle,
  demoTags,
  reverse = false,
}: {
  title: string;
  description: string;
  bullets: string[];
  demoTitle: string;
  demoTags: string[];
  reverse?: boolean;
}) {
  return (
    <Section className="border-t border-border/70 bg-[#fcfbf8] py-14 sm:py-16">
      <Container
        className={`grid gap-10 lg:grid-cols-2 lg:items-center ${
          reverse ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <Stack className="gap-5">
          <Heading as="h2">{title}</Heading>
          <Text className="text-muted">{description}</Text>
          <ul className="grid gap-3 pt-2">
            {bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex gap-3 text-sm leading-6 text-ink"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal"
                />
                {bullet}
              </li>
            ))}
          </ul>
        </Stack>
        <div
          className="rounded-[1.75rem] border border-border bg-surface p-5 shadow-soft"
          aria-label="Product interface demonstration"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <Text className="text-sm font-semibold text-ink">{demoTitle}</Text>
            <span className="rounded-full bg-cobalt/10 px-2.5 py-1 text-xs font-medium text-cobalt">
              Preview
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {demoTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-paper px-3 py-1 text-xs font-medium text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-paper px-3 py-2.5"
              >
                <div className="h-2 w-24 rounded-full bg-border" />
                <div className="h-2 w-10 rounded-full bg-border" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
