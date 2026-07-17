import { Check } from "lucide-react";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { pricingPlans } from "@/content/pricing";

export function PricingTable() {
  return (
    <Section className="py-14 sm:py-16">
      <Container>
        <div className="grid gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <Stack
              key={plan.name}
              className={`gap-5 rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-cobalt bg-surface shadow-soft"
                  : "border-border bg-surface"
              }`}
            >
              <Stack className="gap-2">
                <Text className="text-lg font-semibold text-ink">{plan.name}</Text>
                <Text className="text-sm text-muted">{plan.audience}</Text>
              </Stack>
              <Text className="text-sm font-medium text-cobalt">{plan.priceHypothesis}</Text>
              <Text className="text-sm text-muted">{plan.description}</Text>
              <ul className="space-y-2 border-t border-border/70 pt-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-ink">
                    <Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
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
      </Container>
    </Section>
  );
}
