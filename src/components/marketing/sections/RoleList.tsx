import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading } from "@/components/ui/Typography";
import type { RoleRef } from "@/content/types";

export function RoleList({ title, roles }: { title: string; roles: RoleRef[] }) {
  return (
    <Section className="py-14 sm:py-16">
      <Container>
        <Stack className="gap-6">
          <Heading as="h2">{title}</Heading>
          <dl className="grid gap-x-8 gap-y-5 border-t border-border/70 pt-6 sm:grid-cols-2">
            {roles.map((role) => (
              <div key={role.role} className="flex flex-col gap-1">
                <dt className="text-sm font-semibold text-ink">{role.role}</dt>
                <dd className="text-sm text-muted">{role.description}</dd>
              </div>
            ))}
          </dl>
        </Stack>
      </Container>
    </Section>
  );
}
