import type { ServicePageContent } from "@/content/types";

export const aiServiceContent: ServicePageContent = {
  seo: {
    title: "AI Services — ProcessPilot Technologies",
    description:
      "Independent AI advisory and implementation engagements: readiness assessment, governed AI adoption, and workflow automation advisory, delivered separately from the ProcessPilot SaaS product.",
    path: "/services/ai",
  },
  eyebrow: "Professional services · AI",
  headline: "AI adoption engagements, scoped and delivered as independent projects",
  intro:
    "For organizations evaluating or implementing AI capability outside the ProcessPilot platform, we offer scoped advisory and implementation engagements grounded in the same human-in-the-loop, governed-AI principles behind our own product.",
  accent: "cobalt",
  disclaimer:
    "This is a professional-services engagement, sold and delivered under a separate Statement of Work and Professional Services Terms — not a feature of the ProcessPilot SaaS product, and not included in any subscription plan.",
  offerings: [
    {
      title: "AI readiness assessment",
      description:
        "Evaluate an organization's data, workflows, and governance posture to identify where AI can be introduced safely and where it should not be, before any implementation work begins.",
    },
    {
      title: "Governed AI implementation",
      description:
        "Design and implement AI-assisted capability with explicit human review checkpoints, audit trails, and clear boundaries on what the system is authorized to do without a person approving it.",
    },
    {
      title: "Workflow automation advisory",
      description:
        "Assess existing operational workflows and recommend where automation reduces manual effort without removing accountability for outcomes.",
    },
  ],
  engagementModel: [
    {
      title: "Scoped Statement of Work",
      description:
        "Every engagement starts with a written Statement of Work defining scope, deliverables, timeline, and cost before any work begins — see the Statement of Work template referenced in our Professional Services Terms.",
    },
    {
      title: "Independent from the SaaS product",
      description:
        "Engaging us for AI services does not create or imply a ProcessPilot SaaS subscription, and a ProcessPilot customer relationship does not imply an AI services engagement.",
    },
  ],
  related: [
    {
      label: "Cybersecurity services",
      href: "/services/cybersecurity",
      description: "Security assessments and architecture review as independent engagements.",
    },
    {
      label: "Compliance and governance",
      href: "/services/compliance-governance",
      description: "Regulatory and governance program engagements.",
    },
    {
      label: "ProcessPilot AI copilot",
      href: "/product/audit-center",
      description: "See the governed AI capability built into the ProcessPilot SaaS product.",
    },
  ],
  cta: {
    title: "Have an AI project in scope?",
    description: "Tell us about the project and we'll follow up to discuss fit and scope.",
    primary: { label: "Discuss a project", href: "/request-consultation" },
    secondary: { label: "Explore ProcessPilot", href: "/product" },
  },
};
