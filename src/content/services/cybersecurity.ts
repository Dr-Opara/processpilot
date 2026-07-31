import type { ServicePageContent } from "@/content/types";

export const cybersecurityServiceContent: ServicePageContent = {
  seo: {
    title: "Cybersecurity Services — ProcessPilot Technologies",
    description:
      "Independent cybersecurity advisory engagements: security assessments, architecture review, and incident-response readiness, delivered separately from the ProcessPilot SaaS product.",
    path: "/services/cybersecurity",
  },
  eyebrow: "Professional services · Cybersecurity",
  headline: "Cybersecurity engagements scoped around your actual risk, not a checklist",
  intro:
    "We support selected organizations through independent security assessment, architecture review, and readiness engagements — applying the same security-by-design discipline documented in our own product's threat model.",
  accent: "warning",
  disclaimer:
    "This is a professional-services engagement, sold and delivered under a separate Statement of Work and Professional Services Terms — not a feature of the ProcessPilot SaaS product, and not a compliance or security certification of any kind.",
  offerings: [
    {
      title: "Security assessment",
      description:
        "Review an organization's application, infrastructure, or process-level security posture and produce a prioritized, actionable findings report.",
    },
    {
      title: "Architecture review",
      description:
        "Evaluate a system's design against established security principles — tenant isolation, least privilege, defense in depth — before or after it ships.",
    },
    {
      title: "Incident-response readiness",
      description:
        "Assess and help build an organization's own incident-response plan and escalation process, informed by the same discipline behind ours (see our incident-response and breach-notification runbooks).",
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
        "Engaging us for cybersecurity services does not create or imply a ProcessPilot SaaS subscription, and does not constitute a security audit or certification of the ProcessPilot product itself.",
    },
  ],
  related: [
    {
      label: "AI services",
      href: "/services/ai",
      description: "Governed AI advisory and implementation engagements.",
    },
    {
      label: "Compliance and governance",
      href: "/services/compliance-governance",
      description: "Regulatory and governance program engagements.",
    },
    {
      label: "ProcessPilot security",
      href: "/security",
      description: "How security is built into the ProcessPilot SaaS product itself.",
    },
  ],
  cta: {
    title: "Have a security project in scope?",
    description: "Tell us about the project and we'll follow up to discuss fit and scope.",
    primary: { label: "Discuss a project", href: "/request-consultation" },
    secondary: { label: "Explore ProcessPilot", href: "/product" },
  },
};
