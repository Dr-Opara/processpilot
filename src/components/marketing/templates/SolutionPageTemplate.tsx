import { PageHero } from "@/components/marketing/sections/PageHero";
import { PointsSection } from "@/components/marketing/sections/PointsSection";
import { CapabilitiesGrid } from "@/components/marketing/sections/CapabilitiesGrid";
import { WorkflowSteps } from "@/components/marketing/sections/WorkflowSteps";
import { OutcomesList } from "@/components/marketing/sections/OutcomesList";
import { RelatedLinks } from "@/components/marketing/sections/RelatedLinks";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Layout";
import { demoCompany } from "@/content/site";
import type { SolutionPageContent } from "@/content/types";

export function SolutionPageTemplate({ content }: { content: SolutionPageContent }) {
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
      <Container className="-mt-6 pb-2">
        <Badge>Built for {content.audience}</Badge>
      </Container>
      <PointsSection
        title="What makes this hard today"
        points={content.challenges.map(
          (challenge) => `${challenge.title} — ${challenge.description}`,
        )}
        variant="list"
      />
      <CapabilitiesGrid title="What ProcessPilot provides" items={content.capabilities} />
      <WorkflowSteps
        title={content.workflowExample.title}
        steps={content.workflowExample.steps}
        company={demoCompany.name}
      />
      <OutcomesList title="What changes" outcomes={content.outcomes} />
      <RelatedLinks title="Related solutions" links={content.related} />
      <CtaBand
        title={content.cta.title}
        description={content.cta.description}
        primary={content.cta.primary}
        secondary={content.cta.secondary}
      />
    </>
  );
}
