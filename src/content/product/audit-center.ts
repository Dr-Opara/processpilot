import type { ProductPageContent } from "@/content/types";

export const auditCenterContent: ProductPageContent = {
  seo: {
    title: "Audit center — evidence, approvals, and history in one place",
    description:
      "Keep evidence, approvals, and process history organized and exportable, ready before an audit request instead of assembled during one.",
    path: "/product/audit-center",
  },
  eyebrow: "Improve operations",
  headline: "Be ready for an audit before anyone asks for one",
  intro:
    "Evidence collected during workflow execution — approvals, uploads, sign-offs — stays attached to the process it belongs to, organized and exportable.",
  accent: "warning",
  layout: "governance-first",
  problem: {
    title: "Evidence gets assembled after the fact",
    description:
      "When an audit or incident review happens, evidence lives in email, shared drives, and people's memory, and someone has to piece it together under time pressure.",
    points: [
      "Approvals recorded in email threads, not a searchable system",
      "No single place to confirm an evidence requirement was met",
      "Exporting a clean record for a specific process takes days",
      "No way to prove which policy version was active at a given time",
    ],
  },
  capability: {
    title: "Evidence attached at the source",
    description:
      "Approvals, uploads, and sign-offs are captured as workflows run, then organized by process, location, and date for retrieval or export.",
    bullets: [
      "Evidence automatically attached to the task that generated it",
      "Full approval history with timestamps and approvers",
      "Export a complete record for a specific process or date range",
      "Policy version history tied to when a workflow was executed",
    ],
  },
  workflowExample: {
    title: "Responding to an internal audit request",
    steps: [
      {
        title: "Audit request received",
        description:
          "Compliance is asked to produce onboarding evidence for the Austin office, last quarter.",
      },
      {
        title: "Filter by process and location",
        description:
          "The audit center is filtered to onboarding workflows in Austin.",
      },
      {
        title: "Confirm evidence completeness",
        description:
          "All 8 required evidence items are present for each completed case.",
      },
      {
        title: "Export the record",
        description:
          "A complete evidence bundle is exported for the audit response.",
      },
    ],
  },
  roles: [
    {
      role: "Compliance",
      description:
        "Retrieves and exports evidence without chasing down individual approvers.",
    },
    {
      role: "Process owner",
      description:
        "Confirms required evidence steps are actually being completed.",
    },
    {
      role: "Auditor",
      description:
        "Reviews approval history and evidence for a specific process or period.",
    },
  ],
  uiDemo: {
    title: "Audit center",
    tags: ["Evidence", "Approvals", "Policy versions", "Export"],
  },
  governance: {
    title: "Evidence is retained, not summarized",
    points: [
      "Original uploads and approval records are retained, not just a summary",
      "Retention periods are configurable per data-retention policy",
      "Exports include a record of who generated them and when",
    ],
  },
  related: [
    {
      label: "Knowledge",
      href: "/product/knowledge",
      description: "How policy version history connects to audit evidence.",
    },
    {
      label: "Analytics",
      href: "/product/analytics",
      description: "See patterns in approval and evidence completion rates.",
    },
    {
      label: "Compliance solution",
      href: "/solutions/compliance",
      description: "How audit center fits into a broader compliance program.",
    },
  ],
  cta: {
    title: "Stop assembling evidence under deadline pressure",
    description:
      "See how approvals and evidence stay organized as workflows run, not after.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
