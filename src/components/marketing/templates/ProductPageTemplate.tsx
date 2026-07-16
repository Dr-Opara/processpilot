import { PageHero } from "@/components/marketing/sections/PageHero";
import { PointsSection } from "@/components/marketing/sections/PointsSection";
import { CapabilityDemo } from "@/components/marketing/sections/CapabilityDemo";
import { WorkflowSteps } from "@/components/marketing/sections/WorkflowSteps";
import { RoleList } from "@/components/marketing/sections/RoleList";
import { RelatedLinks } from "@/components/marketing/sections/RelatedLinks";
import { CtaBand } from "@/components/marketing/sections/CtaBand";
import { demoCompany } from "@/content/site";
import type { ProductPageContent } from "@/content/types";

export function ProductPageTemplate({
  content,
}: {
  content: ProductPageContent;
}) {
  const problem = (
    <PointsSection
      key="problem"
      title={content.problem.title}
      description={content.problem.description}
      points={content.problem.points}
      variant="list"
    />
  );

  const capability = (
    <CapabilityDemo
      key="capability"
      title={content.capability.title}
      description={content.capability.description}
      bullets={content.capability.bullets}
      demoTitle={content.uiDemo.title}
      demoTags={content.uiDemo.tags}
      reverse={content.layout === "workflow-first"}
    />
  );

  const workflow = (
    <WorkflowSteps
      key="workflow"
      title={content.workflowExample.title}
      steps={content.workflowExample.steps}
      company={demoCompany.name}
    />
  );

  const governance = (
    <PointsSection
      key="governance"
      title={content.governance.title}
      points={content.governance.points}
      variant="cards"
      className="border-t border-border/70 bg-[#fcfbf8]"
    />
  );

  const roles = (
    <RoleList key="roles" title="Who uses this" roles={content.roles} />
  );

  const orderByLayout: Record<ProductPageContent["layout"], JSX.Element[]> = {
    "capability-first": [capability, problem, workflow, roles, governance],
    "workflow-first": [problem, workflow, capability, roles, governance],
    "governance-first": [problem, governance, capability, workflow, roles],
  };

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
      {orderByLayout[content.layout]}
      <RelatedLinks title="Related product areas" links={content.related} />
      <CtaBand
        title={content.cta.title}
        description={content.cta.description}
        primary={content.cta.primary}
        secondary={content.cta.secondary}
      />
    </>
  );
}
