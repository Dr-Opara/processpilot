import { Check } from "lucide-react";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { pricingPlans } from "@/content/pricing";

export function PricingPreview() {
  return (
    <Section className="border-t border-border/70 bg-[#fcfbf8] py-16 sm:py-20">
      <Container>
        <Stack className="gap-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Stack className="max-w-xl gap-3">
              <Heading as="h2">Plans for one team or every location</Heading>
              <Text className="text-muted">
                Three plan concepts, scaled to how many locations and departments you&apos;re
                standardizing.
              </Text>
            </Stack>
            <Button href="/pricing" variant="quiet">
              See full plan comparison
            </Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <Stack
                key={plan.name}
                className={`gap-4 rounded-2xl border p-6 ${
                  plan.highlighted
                    ? "border-cobalt bg-surface shadow-soft"
                    : "border-border bg-surface"
                }`}
              >
                <Stack className="gap-1">
                  <Text className="font-semibold text-ink">{plan.name}</Text>
                  <Text className="text-sm text-muted">{plan.audience}</Text>
                </Stack>
                <ul className="space-y-2">
                  {plan.features.slice(0, 3).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted">
                      <Check
                        size={16}
                        className="mt-0.5 shrink-0 text-success"
                        aria-hidden="true"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  href={plan.cta.href}
                  variant={plan.highlighted ? "primary" : "secondary"}
                  className="w-full"
                >
                  {plan.cta.label}
                </Button>
              </Stack>
            ))}
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
