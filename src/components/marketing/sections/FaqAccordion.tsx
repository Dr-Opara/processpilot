"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import type { FaqItem } from "@/content/types";

export function FaqAccordion({
  title = "Frequently asked questions",
  items,
}: {
  title?: string;
  items: FaqItem[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <Section className="border-t border-border/70 py-14 sm:py-16">
      <Container className="max-w-3xl">
        <Stack className="gap-6">
          <Heading as="h2">{title}</Heading>
          <div className="divide-y divide-border/70 border-t border-border/70">
            {items.map((item, index) => {
              const isOpen = openIndex === index;
              const panelId = `${baseId}-panel-${index}`;
              const buttonId = `${baseId}-button-${index}`;

              return (
                <div key={item.question}>
                  <h3>
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
                    >
                      {item.question}
                      <ChevronDown
                        size={18}
                        aria-hidden="true"
                        className={`shrink-0 text-muted transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    hidden={!isOpen}
                    className="pb-5"
                  >
                    <Text className="text-sm text-muted">{item.answer}</Text>
                  </div>
                </div>
              );
            })}
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
