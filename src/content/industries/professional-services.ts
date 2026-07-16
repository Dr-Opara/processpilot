import type { IndustryPageContent } from "@/content/types";

export const professionalServicesContent: IndustryPageContent = {
  seo: {
    title:
      "Professional services — delivery playbooks that hold up under growth",
    description:
      "Standardize client onboarding and delivery playbooks so quality doesn't depend on which team member is staffed on the engagement.",
    path: "/industries/professional-services",
  },
  eyebrow: "Professional services",
  headline: "Delivery quality that doesn't depend on who's staffed",
  intro:
    "As a services firm grows, delivery quality often depends on which consultant or account lead is on the engagement. A shared playbook keeps quality consistent as headcount grows.",
  accent: "cobalt",
  disclaimer:
    "ProcessPilot standardizes internal delivery processes. It does not provide legal, tax, or professional advisory services, and does not review client deliverables for professional accuracy.",
  challenges: [
    {
      title: "Client onboarding varies by account lead",
      description:
        "Each new client engagement starts slightly differently depending on who's running it, creating inconsistent first impressions.",
    },
    {
      title: "Delivery playbooks live in someone's head",
      description:
        "Best practices for running an engagement are informally passed down rather than documented and followed.",
    },
    {
      title: "Quality checks are inconsistent",
      description:
        "Without a shared review step, deliverable quality depends on which reviewer happens to be available.",
    },
  ],
  workflows: [
    {
      title: "Client onboarding",
      description:
        "A standard kickoff workflow from signed contract to first working session.",
    },
    {
      title: "Engagement delivery playbooks",
      description:
        "Repeatable phase-by-phase workflows for common engagement types.",
    },
    {
      title: "Quality review checkpoints",
      description:
        "Built-in review and approval steps before a deliverable reaches the client.",
    },
  ],
  whoUses: [
    {
      role: "Engagement lead",
      description:
        "Runs client delivery against a standard, repeatable playbook.",
    },
    {
      role: "Consultant",
      description: "Follows assigned tasks for their phase of the engagement.",
    },
    {
      role: "Practice lead",
      description:
        "Reviews delivery consistency and quality-check completion across engagements.",
    },
  ],
  lifecycle: [
    {
      title: "Import",
      description:
        "An existing delivery methodology is imported as a starting draft.",
    },
    {
      title: "Publish",
      description:
        "A practice lead reviews and publishes the standard playbook.",
    },
    {
      title: "Run",
      description: "Engagement teams execute the workflow for each new client.",
    },
    {
      title: "Review",
      description:
        "Delivery data informs updates to the next playbook version.",
    },
  ],
  templates: [
    {
      name: "Client onboarding kickoff",
      description:
        "A standard workflow from signed contract to first working session.",
    },
    {
      name: "Engagement quality checkpoint",
      description:
        "A review-and-approval step inserted before client-facing deliverables ship.",
    },
  ],
  related: [
    {
      label: "Operations solution",
      href: "/solutions/operations",
      description: "The broader case for standardized delivery execution.",
    },
    {
      label: "Customer operations solution",
      href: "/solutions/customer-operations",
      description: "How client-facing requests are handled consistently.",
    },
    {
      label: "Training",
      href: "/product/training",
      description: "Onboarding new consultants onto the delivery playbook.",
    },
  ],
  cta: {
    title: "Turn your best engagement lead's approach into the standard",
    description:
      "See how a delivery playbook keeps quality consistent as your team grows.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
