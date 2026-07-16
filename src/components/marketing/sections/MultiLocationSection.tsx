import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Badge } from "@/components/ui/Badge";
import { demoCompany } from "@/content/site";

export function MultiLocationSection() {
  return (
    <Section className="border-t border-border/70 bg-[#fcfbf8] py-16 sm:py-20">
      <Container>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <Stack className="gap-4">
            <Heading as="h2">
              One operating model, applied at every location
            </Heading>
            <Text className="text-muted">
              A central team owns the standard process. Each location runs it
              with room for the local exceptions that are actually necessary —
              without forking the whole workflow.
            </Text>
            <Badge className="w-fit border-cobalt/30 bg-cobalt/5 text-cobalt">
              Product demonstration · {demoCompany.name}
            </Badge>
          </Stack>
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <Text className="text-sm font-semibold text-ink">
              {demoCompany.exampleProcess.name} — completion by location
            </Text>
            <div className="mt-4 space-y-3">
              {demoCompany.locations.map((location, index) => {
                const rate = [92, 88, 95][index];
                return (
                  <div key={location}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink">{location}</span>
                      <span className="text-muted">{rate}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-border">
                      <div
                        className="h-2 rounded-full bg-cobalt"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
