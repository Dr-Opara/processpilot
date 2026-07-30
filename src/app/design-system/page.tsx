import React from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text, Eyebrow, Label, CodeText } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoShell } from "@/components/application/DemoShell";

export default function DesignSystemPage() {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM === "true";

  if (!enabled) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Section className="border-b border-border/70">
        <Container className="py-16">
          <Stack className="gap-4">
            <Eyebrow>Internal demonstration content</Eyebrow>
            <Heading as="h1">ProcessPilot design system</Heading>
            <Text className="max-w-3xl text-lg text-muted">
              This route is intentionally internal and only available when the design-system flag is
              enabled.
            </Text>
          </Stack>
        </Container>
      </Section>

      <Container className="grid gap-10 py-16 lg:grid-cols-[1.25fr_0.75fr]">
        <Stack className="gap-8">
          <Section className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
            <Stack className="gap-4">
              <Heading as="h2">Brand assets</Heading>
              <div className="flex flex-wrap gap-3">
                <Badge>ProcessPilot</Badge>
                <StatusBadge status="success">Approved</StatusBadge>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <Image
                  src="/brand/branding/processpilot-logo.png"
                  alt="ProcessPilot logo"
                  width={166}
                  height={32}
                  className="h-8 w-auto"
                />
                <Image
                  src="/brand/branding/processpilot-icon.png"
                  alt="ProcessPilot icon"
                  width={40}
                  height={40}
                  className="h-10 w-10"
                />
              </div>
              <Text className="text-sm text-muted">
                Approved logo and icon assets live in <CodeText>public/brand/</CodeText>. See{" "}
                <CodeText>public/brand/README.md</CodeText> and{" "}
                <CodeText>design/branding.md</CodeText>.
              </Text>
            </Stack>
          </Section>

          <Section className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
            <Stack className="gap-4">
              <Heading as="h2">Buttons and forms</Heading>
              <div className="flex flex-wrap gap-3">
                <Button>Primary action</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="quiet">Quiet</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" placeholder="Ada Lovelace" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" placeholder="ada@useprocesspilot.com" />
                </div>
              </div>
            </Stack>
          </Section>

          <Section className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
            <Stack className="gap-4">
              <Heading as="h2">Statuses and alerts</Heading>
              <Alert
                title="Ready for review"
                description="The design system shell is fully interactive and keyboard-friendly."
              />
              <div className="flex flex-wrap gap-3">
                <StatusBadge status="success">Success</StatusBadge>
                <StatusBadge status="warning">Warning</StatusBadge>
                <StatusBadge status="danger">Danger</StatusBadge>
              </div>
            </Stack>
          </Section>
        </Stack>

        <Stack className="gap-6">
          <DemoShell />
        </Stack>
      </Container>
    </div>
  );
}
