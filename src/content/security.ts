export interface SecurityControl {
  title: string;
  description: string;
  status: "Planned";
}

export const securityControls: SecurityControl[] = [
  {
    title: "Tenant isolation architecture",
    description:
      "Each customer organization's workflows, documents, and evidence are designed to be logically separated so one organization cannot access another's data.",
    status: "Planned",
  },
  {
    title: "Role-based access",
    description:
      "Access to a workflow, document, or report is scoped to a person's assigned role within their organization.",
    status: "Planned",
  },
  {
    title: "Encryption",
    description:
      "Data is designed to be encrypted in transit and at rest using industry-standard protocols.",
    status: "Planned",
  },
  {
    title: "Private file storage",
    description:
      "Uploaded evidence and documents are designed to be stored privately, not publicly accessible by default or by URL guessing.",
    status: "Planned",
  },
  {
    title: "Audit logging",
    description:
      "Approvals, publishes, edits, and access-relevant actions are designed to be logged with a timestamp and actor.",
    status: "Planned",
  },
  {
    title: "Human review of AI output",
    description:
      "AI-assisted drafts, suggestions, and summaries are designed to require human review and approval before they affect a live workflow.",
    status: "Planned",
  },
  {
    title: "Data retention controls",
    description:
      "Organizations are designed to be able to configure retention periods for evidence and workflow history, consistent with their own policies.",
    status: "Planned",
  },
  {
    title: "SSO roadmap",
    description:
      "Single sign-on for enterprise identity providers is on the product roadmap and not yet available.",
    status: "Planned",
  },
];

export const certificationDisclaimer =
  "ProcessPilot is currently in early development. We do not claim SOC 2, ISO 27001, HIPAA, FedRAMP, HITRUST, GDPR, or PCI certification at this time. The controls on this page describe how the product is designed to work; they are not audited or certified claims.";

export const securityContactEmail = "security@processpilot.com";
