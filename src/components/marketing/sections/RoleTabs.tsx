"use client";

import { useId, useRef, useState } from "react";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Badge } from "@/components/ui/Badge";
import { demoCompany } from "@/content/site";

const roleDemos = [
  {
    role: "Employee",
    summary: "Follows a guided workflow one task at a time, with training and context attached.",
    panel: {
      heading: "New employee onboarding — task 4 of 14",
      rows: [
        "Complete IT equipment request",
        "Acknowledge remote work policy",
        "Watch: Workplace safety training",
      ],
    },
  },
  {
    role: "Manager",
    summary: "Sees team workload, approves exceptions, and reassigns work when someone is out.",
    panel: {
      heading: "Approval queue — Dallas office",
      rows: [
        "Equipment request awaiting approval",
        "Manager sign-off: 90-day check-in",
        "Exception: late document upload",
      ],
    },
  },
  {
    role: "Process owner",
    summary: "Publishes new workflow versions and reviews where the current version breaks down.",
    panel: {
      heading: "New employee onboarding — v6 draft",
      rows: [
        "2 conditional branches under review",
        "8 evidence requirements mapped",
        "Ready to publish to all locations",
      ],
    },
  },
  {
    role: "Compliance",
    summary: "Pulls evidence and approval history for a process without asking around for it.",
    panel: {
      heading: "Audit trail — onboarding, Austin",
      rows: [
        "3 of 3 approvals recorded",
        "Policy acknowledgment: signed, timestamped",
        "Evidence bundle ready to export",
      ],
    },
  },
  {
    role: "Executive",
    summary: "Sees completion rates and exception volume across locations in one view.",
    panel: {
      heading: "Onboarding performance — 3 locations",
      rows: [
        "Houston: 92% on-time completion",
        "Dallas: 88% on-time completion",
        "Austin: 95% on-time completion",
      ],
    },
  },
];

export function RoleTabs() {
  const [activeIndex, setActiveIndex] = useState(0);
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function focusTab(index: number) {
    const nextIndex = (index + roleDemos.length) % roleDemos.length;
    setActiveIndex(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(activeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(roleDemos.length - 1);
    }
  }

  return (
    <Section className="border-t border-border/70 py-14 sm:py-16">
      <Container>
        <Stack className="gap-6">
          <Stack className="max-w-2xl gap-3">
            <Heading as="h2">See it from every role</Heading>
            <Text className="text-muted">
              ProcessPilot looks different depending on who is using it. Select a role to see what
              they see.
            </Text>
          </Stack>

          <div
            role="tablist"
            aria-label="Role previews"
            className="flex flex-wrap gap-2"
            onKeyDown={handleKeyDown}
          >
            {roleDemos.map((demo, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={demo.role}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  role="tab"
                  id={`${baseId}-tab-${index}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel-${index}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveIndex(index)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt ${
                    selected
                      ? "bg-ink text-surface"
                      : "border border-border bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {demo.role}
                </button>
              );
            })}
          </div>

          {roleDemos.map((demo, index) => (
            <div
              key={demo.role}
              role="tabpanel"
              id={`${baseId}-panel-${index}`}
              aria-labelledby={`${baseId}-tab-${index}`}
              hidden={index !== activeIndex}
              className={`gap-6 rounded-[1.75rem] border border-border bg-surface p-6 shadow-soft lg:grid-cols-[0.9fr_1.1fr] ${
                index === activeIndex ? "grid" : "hidden"
              }`}
            >
              <Stack className="gap-3">
                <Text className="font-semibold text-ink">{demo.role}</Text>
                <Text className="text-sm text-muted">{demo.summary}</Text>
                <Badge className="w-fit border-cobalt/30 bg-cobalt/5 text-cobalt">
                  Product demonstration · {demoCompany.name}
                </Badge>
              </Stack>
              <div className="rounded-2xl border border-border bg-paper p-4">
                <Text className="text-sm font-semibold text-ink">{demo.panel.heading}</Text>
                <ul className="mt-3 space-y-2">
                  {demo.panel.rows.map((row) => (
                    <li
                      key={row}
                      className="rounded-xl border border-border/70 bg-surface px-3 py-2.5 text-sm text-muted"
                    >
                      {row}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </Stack>
      </Container>
    </Section>
  );
}
