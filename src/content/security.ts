/**
 * Phase 25/29: corrected from every control being permanently labeled
 * "Planned" (stale since Phase 2, before any of this was built) to
 * reflect what's actually implemented per docs/architecture/
 * security-hardening.md and threat-model.md's Phase 22 review. Still
 * never claims a certification or independent audit — see
 * certificationDisclaimer.
 */
export interface SecurityControl {
  title: string;
  description: string;
  status: "Implemented" | "Partial" | "Planned";
}

export const securityControls: SecurityControl[] = [
  {
    title: "Tenant isolation architecture",
    description:
      "Every customer organization's data is logically separated by Row-Level Security policies plus application-layer scoping, enforced on every one of the product's tables and statically verified in CI.",
    status: "Implemented",
  },
  {
    title: "Role-based access",
    description:
      "Access to a workflow, document, or report is scoped by role and permission within a person's organization, including custom roles bounded so they can never exceed the granting admin's own access.",
    status: "Implemented",
  },
  {
    title: "Encryption",
    description:
      "Third-party credentials and webhook secrets are encrypted at rest (AES-256-GCM); traffic to and from ProcessPilot is encrypted in transit (HTTPS/TLS).",
    status: "Implemented",
  },
  {
    title: "Private file storage",
    description:
      "Uploaded evidence and knowledge documents are stored in private buckets and served only via signed URLs issued after a server-side permission check.",
    status: "Implemented",
  },
  {
    title: "Audit logging",
    description:
      "Approvals, publishes, edits, membership, role, and other governance-relevant actions are recorded in an immutable audit log with a timestamp and actor.",
    status: "Implemented",
  },
  {
    title: "Human review of AI output",
    description:
      "AI-assisted drafts, suggestions, and summaries require an explicit human accept/dismiss action before affecting a live workflow — this is enforced structurally, not just by convention.",
    status: "Implemented",
  },
  {
    title: "Data retention controls",
    description:
      "Organization admins can configure retention preferences for audit, evidence, and exception data. These preferences are stored today; automatic enforcement (a scheduled purge) is not yet built.",
    status: "Partial",
  },
  {
    title: "Single sign-on (SSO)",
    description:
      "SAML/OIDC single sign-on is available via our identity provider's enterprise connections. This has not yet been exercised end-to-end against a live customer identity provider in production.",
    status: "Partial",
  },
  {
    title: "Malware/virus scanning on uploads",
    description:
      "File uploads are validated by content signature and hashed, but are not yet scanned by a malware-detection service — no vendor is selected for this yet.",
    status: "Planned",
  },
];

export const certificationDisclaimer =
  'ProcessPilot has not undergone a SOC 2, ISO 27001, HIPAA, FedRAMP, HITRUST, GDPR, or PCI certification or independent third-party audit. The controls on this page describe what is actually implemented in the product; "Partial" and "Planned" items are labeled as such, not claimed as complete.';

export const securityContactEmail = "security@useprocesspilot.com";
