import { Check } from "lucide-react";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { pricingNote, pricingPlans } from "@/content/pricing";

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
                <div className="flex items-center justify-between gap-2">
                  <Text className="text-lg font-semibold text-ink">{plan.name}</Text>
                  {plan.badge ? (
                    <span className="rounded-full bg-cobalt px-3 py-1 text-xs font-semibold text-surface">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
              </Stack>
              <Stack className="gap-1">
                <Text className="text-3xl font-semibold text-ink">{plan.price}</Text>
                <Text className="text-sm text-muted">{plan.priceDetail}</Text>
                {plan.annualPrice ? (
                  <Text className="text-sm font-medium text-cobalt">{plan.annualPrice}</Text>
                ) : null}
              </Stack>
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
        <Text className="mt-8 text-center text-sm text-muted">{pricingNote}</Text>
      </Container>
    </Section>
  );
}
