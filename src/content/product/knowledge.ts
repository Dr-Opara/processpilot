import type { ProductPageContent } from "@/content/types";

export const knowledgeContent: ProductPageContent = {
  seo: {
    title: "Knowledge — a governed source of truth for procedures",
    description:
      "Keep policies, SOPs, and institutional knowledge in one versioned library instead of scattered documents and shared drives.",
    path: "/product/knowledge",
  },
  eyebrow: "Govern knowledge",
  headline: "Keep policies and procedures in one place people actually trust",
  intro:
    "Most companies have SOPs. Few have a single, current version that everyone is actually reading. Knowledge gives every policy and procedure one governed home.",
  accent: "cobalt",
  layout: "governance-first",
  problem: {
    title: "The document is never the one people are using",
    description:
      "Policies get copied into email, printed, or saved to a personal folder. By the time something changes, three versions are circulating.",
    points: [
      "No single owner for a given policy or procedure",
      "No record of who approved the current version",
      "Employees default to asking a coworker instead of checking the document",
      "Old PDFs keep circulating after a policy changes",
    ],
  },
  capability: {
    title: "A controlled, versioned library",
    description:
      "Every policy and procedure has one owner, one current version, and a visible history of what changed and when.",
    bullets: [
      "Import existing documents as a starting point",
      "Version history with who changed what",
      "Ownership assigned per document, not per department",
      "Search across every published policy and procedure",
    ],
  },
  workflowExample: {
    title: "Publishing a revised maintenance policy",
    steps: [
      {
        title: "Import the current PDF",
        description:
          "Operations uploads the existing vendor maintenance policy from a shared drive.",
      },
      {
        title: "Assign an owner",
        description:
          "The Operations lead is set as the document owner and reviewer for future changes.",
      },
      {
        title: "Edit and tag",
        description:
          "The policy is tagged to the maintenance-request workflow it governs.",
      },
      {
        title: "Publish a new version",
        description:
          "The updated version replaces the old one; prior versions remain visible in history.",
      },
    ],
  },
  roles: [
    {
      role: "Process owner",
      description: "Owns a policy or procedure and approves changes to it.",
    },
    {
      role: "Compliance",
      description:
        "Confirms the current version matches what's actually being followed.",
    },
    {
      role: "Employee",
      description:
        "Reads the current version linked directly from their workflow.",
    },
  ],
  uiDemo: {
    title: "Knowledge library",
    tags: ["SOPs", "Policies", "Version history", "Owners"],
  },
  governance: {
    title: "Version control and ownership",
    points: [
      "Every document has exactly one current version",
      "Prior versions are retained, not deleted",
      "Changes require an assigned owner to publish",
    ],
  },
  related: [
    {
      label: "Process builder",
      href: "/product/process-builder",
      description: "Turn a published document into a structured workflow.",
    },
    {
      label: "Audit center",
      href: "/product/audit-center",
      description: "See the approval history behind any published policy.",
    },
    {
      label: "Compliance solution",
      href: "/solutions/compliance",
      description:
        "How controlled documents fit into a broader compliance program.",
    },
  ],
  cta: {
    title: "Start with the policies people ask about most",
    description:
      "Import your highest-traffic SOPs first and give them a single, governed home.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
