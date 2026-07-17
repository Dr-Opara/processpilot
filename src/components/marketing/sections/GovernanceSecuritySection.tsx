import { ShieldCheck, KeyRound, FileClock, Lock } from "lucide-react";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";

const controls = [
  {
    icon: KeyRound,
    title: "Role-based access",
    description: "People see the workflows and data relevant to their role.",
  },
  {
    icon: Lock,
    title: "Tenant isolation",
    description: "Each customer's workflows, files, and data are kept separate.",
  },
  {
    icon: FileClock,
    title: "Audit logging",
    description: "Approvals, edits, and publishes are recorded with a timestamp.",
  },
  {
    icon: ShieldCheck,
    title: "Private file storage",
    description: "Uploaded evidence and documents are not publicly accessible.",
  },
];

export function GovernanceSecuritySection() {
  return (
    <Section className="border-t border-border/70 py-16 sm:py-20">
      <Container>
        <Stack className="gap-8">
          <Stack className="max-w-2xl gap-3">
            <Heading as="h2">Built with governance in mind</Heading>
            <Text className="text-muted">
              Operational data — approvals, evidence, and process history — deserves the same care
              as any other system of record.
            </Text>
          </Stack>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {controls.map(({ icon: Icon, title, description }) => (
              <Stack key={title} className="gap-2">
                <Icon size={20} className="text-cobalt" aria-hidden="true" />
                <Text className="font-semibold text-ink">{title}</Text>
                <Text className="text-sm text-muted">{description}</Text>
              </Stack>
            ))}
          </div>
          <Button href="/security" variant="secondary" className="w-fit">
            Review security details
          </Button>
        </Stack>
      </Container>
    </Section>
  );
}
