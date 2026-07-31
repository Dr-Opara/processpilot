import type { ServicePageContent } from "@/content/types";

export const complianceGovernanceServiceContent: ServicePageContent = {
  seo: {
    title: "Compliance and Governance Services — ProcessPilot Technologies",
    description:
      "Independent compliance, governance, and federal-program readiness engagements, delivered separately from the ProcessPilot SaaS product.",
    path: "/services/compliance-governance",
  },
  eyebrow: "Professional services · Compliance and Governance",
  headline: "Governance and federal-program readiness, scoped as an independent engagement",
  intro:
    "We support selected organizations — including federal agencies and contractors — through independent compliance, governance-framework, and program-readiness engagements.",
  accent: "success",
  disclaimer:
    "This is a professional-services engagement, sold and delivered under a separate Statement of Work and Professional Services Terms — not a feature of the ProcessPilot SaaS product, and not a legal or compliance certification of any kind.",
  offerings: [
    {
      title: "Governance framework design",
      description:
        "Design or refine a governance framework — decision rights, control ownership, review cadence — appropriate to an organization's regulatory environment.",
    },
    {
      title: "Compliance program readiness",
      description:
        "Assess a compliance program against applicable requirements and produce a prioritized remediation plan.",
    },
    {
      title: "Federal program readiness",
      description:
        "Support federal agencies and contractors preparing for a specific program, audit, or operational-readiness milestone.",
    },
  ],
  engagementModel: [
    {
      title: "Scoped Statement of Work",
      description:
        "Every engagement starts with a written Statement of Work defining scope, deliverables, timeline, and cost before any work begins.",
    },
    {
      title: "Independent from the SaaS product",
      description:
        "Engaging us for compliance or governance services does not create or imply a ProcessPilot SaaS subscription. See Client Engagements for specific named engagements we're able to disclose.",
    },
  ],
  related: [
    {
      label: "AI services",
      href: "/services/ai",
      description: "Governed AI advisory and implementation engagements.",
    },
    {
      label: "Cybersecurity services",
      href: "/services/cybersecurity",
      description: "Security assessment and architecture review engagements.",
    },
    {
      label: "Client engagements",
      href: "/engagements",
      description: "Selected independent engagements we're able to name.",
    },
  ],
  cta: {
    title: "Have a compliance or governance project in scope?",
    description: "Tell us about the project and we'll follow up to discuss fit and scope.",
    primary: { label: "Discuss a project", href: "/request-consultation" },
    secondary: { label: "Explore ProcessPilot", href: "/product" },
  },
};
