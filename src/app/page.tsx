import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Button } from "@/components/ui/Button";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text, Eyebrow } from "@/components/ui/Typography";
import { ProductPreviewFrame } from "@/components/marketing/ProductPreviewFrame";
import { BusinessProblem } from "@/components/marketing/sections/BusinessProblem";
import { OperatingLoop } from "@/components/marketing/sections/OperatingLoop";
import { PillarsGrid } from "@/components/marketing/sections/PillarsGrid";
import { RoleTabs } from "@/components/marketing/sections/RoleTabs";
import { ProcedureTransformDemo } from "@/components/marketing/sections/ProcedureTransformDemo";
import { AICapabilities } from "@/components/marketing/sections/AICapabilities";
import { MultiLocationSection } from "@/components/marketing/sections/MultiLocationSection";
import { GovernanceSecuritySection } from "@/components/marketing/sections/GovernanceSecuritySection";
import { PricingPreview } from "@/components/marketing/sections/PricingPreview";
import { FaqAccordion } from "@/components/marketing/sections/FaqAccordion";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { homepageFaqs } from "@/content/homepage";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "The operating system for repeatable work",
  description:
    "ProcessPilot converts policies, SOPs, and institutional knowledge into guided workflows, role-based training, approvals, evidence, and operational insight.",
  path: "/",
});

export default function Home() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <Section className="border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(247,245,240,1))]">
          <Container className="grid gap-10 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <Stack className="max-w-2xl gap-6">
              <Eyebrow>The operating system for repeatable work</Eyebrow>
              <Heading as="h1" className="max-w-xl font-serif text-5xl leading-tight sm:text-6xl">
                Turn company procedures into work people can actually complete.
              </Heading>
              <Text className="max-w-xl text-lg text-muted">
                ProcessPilot converts policies, SOPs, and institutional knowledge into guided
                workflows, role-based training, approvals, evidence, and operational insight.
              </Text>
              <div className="flex flex-wrap gap-3">
                <Button href="/product">See the platform</Button>
                <Button href="/request-demo" variant="secondary">
                  Request a demo
                </Button>
              </div>
            </Stack>
            <ProductPreviewFrame />
          </Container>
        </Section>

        <BusinessProblem />
        <OperatingLoop />
        <PillarsGrid />
        <RoleTabs />
        <ProcedureTransformDemo />
        <AICapabilities />
        <MultiLocationSection />
        <GovernanceSecuritySection />
        <PricingPreview />
        <FaqAccordion items={homepageFaqs} />

        <CtaBand
          title="See how your procedures would run in ProcessPilot"
          description="Walk through a live demo with your own process, or start a free trial and publish your first workflow today."
          primary={{ label: "Request a demo", href: "/request-demo" }}
          secondary={{ label: "Start free trial", href: "/start-trial" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
