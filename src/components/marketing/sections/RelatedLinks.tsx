import { ArrowUpRight } from "lucide-react";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import type { RelatedLink } from "@/content/types";

export function RelatedLinks({
  title = "Related",
  links,
}: {
  title?: string;
  links: RelatedLink[];
}) {
  if (links.length === 0) return null;

  return (
    <Section className="border-t border-border/70 bg-[#fcfbf8] py-14 sm:py-16">
      <Container>
        <Stack className="gap-6">
          <Heading as="h2">{title}</Heading>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="group flex h-full flex-col gap-2 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-cobalt"
                >
                  <span className="flex items-center justify-between text-sm font-semibold text-ink">
                    {link.label}
                    <ArrowUpRight
                      size={16}
                      className="text-muted transition-colors group-hover:text-cobalt"
                      aria-hidden="true"
                    />
                  </span>
                  <Text className="text-sm text-muted">{link.description}</Text>
                </a>
              </li>
            ))}
          </ul>
        </Stack>
      </Container>
    </Section>
  );
}
