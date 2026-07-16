import { PageHero } from "@/components/marketing/sections/PageHero";
import { PointsSection } from "@/components/marketing/sections/PointsSection";
import { CapabilitiesGrid } from "@/components/marketing/sections/CapabilitiesGrid";
import { RoleList } from "@/components/marketing/sections/RoleList";
import { WorkflowSteps } from "@/components/marketing/sections/WorkflowSteps";
import { RelatedLinks } from "@/components/marketing/sections/RelatedLinks";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { Alert } from "@/components/ui/Alert";
import { Container } from "@/components/ui/Layout";
import type { IndustryPageContent } from "@/content/types";

export function IndustryPageTemplate({
  content,
}: {
  content: IndustryPageContent;
}) {
  return (
    <>
      <PageHero
        eyebrow={content.eyebrow}
        headline={content.headline}
        intro={content.intro}
        accent={content.accent}
        primary={{ label: "Request a demo", href: "/request-demo" }}
        secondary={{ label: "Start free trial", href: "/start-trial" }}
      />
      <Container className="-mt-4 pb-10">
        <Alert
          title="Operational tooling, not a compliance guarantee"
          description={content.disclaimer}
        />
      </Container>
      <PointsSection
        title="Common operational challenges"
        points={content.challenges.map((c) => `${c.title} — ${c.description}`)}
        variant="list"
      />
      <CapabilitiesGrid
        title="Relevant ProcessPilot workflows"
        items={content.workflows}
      />
      <RoleList title="Who uses ProcessPilot here" roles={content.whoUses} />
      <WorkflowSteps
        title="How the process lifecycle works"
        steps={content.lifecycle}
      />
      <PointsSection
        title="Example templates"
        points={content.templates.map((t) => `${t.name} — ${t.description}`)}
        variant="cards"
        className="border-t border-border/70 bg-[#fcfbf8]"
      />
      <RelatedLinks
        title="Related industries and solutions"
        links={content.related}
      />
      <CtaBand
        title={content.cta.title}
        description={content.cta.description}
        primary={content.cta.primary}
        secondary={content.cta.secondary}
      />
    </>
  );
}
