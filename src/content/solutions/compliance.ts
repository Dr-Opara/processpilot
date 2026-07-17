import type { SolutionPageContent } from "@/content/types";

export const complianceSolutionContent: SolutionPageContent = {
  seo: {
    title: "Compliance — controlled documents, evidence, and audit history",
    description:
      "Keep controlled documents, evidence, approvals, and audit history organized and exportable for internal and external review.",
    path: "/solutions/compliance",
  },
  eyebrow: "Solutions for Compliance",
  headline: "Evidence that's organized before the audit request, not after",
  intro:
    "Compliance teams need proof that a policy was followed, not just that it was written. ProcessPilot ties evidence to the workflow that generated it.",
  accent: "warning",
  audience: "compliance, risk, and quality leaders",
  challenges: [
    {
      title: "Controlled documents drift",
      description:
        "Multiple versions of the same policy circulate, with no clear record of which one was active when.",
    },
    {
      title: "Evidence is scattered across systems",
      description:
        "Approvals, uploads, and sign-offs live in different tools with no shared retrieval path.",
    },
    {
      title: "Audit prep is a fire drill",
      description:
        "Producing a clean record for a specific process and time period takes days of manual assembly.",
    },
  ],
  capabilities: [
    {
      title: "Controlled documents",
      description: "Every policy has one owner, one current version, and a visible change history.",
    },
    {
      title: "Evidence",
      description: "Approvals, uploads, and confirmations captured automatically as workflows run.",
    },
    {
      title: "Approvals",
      description:
        "Every required approval is recorded with a timestamp and the approver's identity.",
    },
    {
      title: "Audit history",
      description:
        "A complete, exportable record of what happened, when, and under which policy version.",
    },
  ],
  workflowExample: {
    title: "Responding to a quarterly compliance review",
    steps: [
      {
        title: "Scope the request",
        description: "Compliance is asked for evidence on onboarding across all three locations.",
      },
      {
        title: "Filter the audit center",
        description: "Records are filtered by process, location, and quarter.",
      },
      {
        title: "Verify evidence completeness",
        description: "Each case shows whether all required evidence items are present.",
      },
      {
        title: "Export the response",
        description: "A complete evidence bundle is exported with a generation record.",
      },
    ],
  },
  outcomes: [
    "One current version of every controlled document",
    "Evidence retrieval takes minutes, not days",
    "Approval history is provable, not reconstructed from memory",
    "Audit responses are ready before the request arrives",
  ],
  related: [
    {
      label: "Audit center",
      href: "/product/audit-center",
      description: "Where evidence and approval history are organized.",
    },
    {
      label: "Knowledge",
      href: "/product/knowledge",
      description: "How controlled documents are versioned and owned.",
    },
    {
      label: "Security",
      href: "/security",
      description: "How ProcessPilot protects evidence and controlled data.",
    },
  ],
  cta: {
    title: "See how evidence stays organized as work happens",
    description:
      "Walk through an audit response using workflow-generated evidence instead of email threads.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
