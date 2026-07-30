/**
 * Centralized legal-document registry (Phase 25) — the single source of
 * truth for every legal page's version, effective date, and review
 * status, so a page component never hand-writes "Last updated" text
 * that can drift from reality. `status` distinguishes a working draft
 * from an attorney-reviewed document; nothing in this codebase claims
 * `approved` status without that review actually having happened —
 * every entry here is honestly `draft` until real legal review occurs.
 */
export type LegalDocumentStatus =
  "draft" | "internal_review" | "attorney_review_pending" | "approved";

export interface LegalDocument {
  slug: string;
  title: string;
  version: string;
  effectiveDate: string;
  status: LegalDocumentStatus;
  path: string;
}

export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    version: "0.2.0",
    effectiveDate: "2026-08-06",
    status: "draft",
    path: "/terms",
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    version: "0.2.0",
    effectiveDate: "2026-08-06",
    status: "draft",
    path: "/privacy",
  },
  acceptableUse: {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    version: "0.1.0",
    effectiveDate: "2026-08-06",
    status: "draft",
    path: "/legal/acceptable-use",
  },
  subprocessors: {
    slug: "subprocessors",
    title: "Subprocessors",
    version: "0.1.0",
    effectiveDate: "2026-08-06",
    status: "draft",
    path: "/legal/subprocessors",
  },
  dpa: {
    slug: "dpa",
    title: "SaaS Data Processing Addendum (template)",
    version: "0.1.0",
    effectiveDate: "2026-08-06",
    status: "draft",
    path: "/legal/dpa",
  },
  professionalServicesTerms: {
    slug: "professional-services-terms",
    title: "Professional Services Terms",
    version: "0.1.0",
    effectiveDate: "2026-08-06",
    status: "draft",
    path: "/legal/professional-services-terms",
  },
  statementOfWork: {
    slug: "statement-of-work-template",
    title: "Statement of Work Template",
    version: "0.1.0",
    effectiveDate: "2026-08-06",
    status: "draft",
    path: "/legal/statement-of-work-template",
  },
  independentContractor: {
    slug: "independent-contractor-template",
    title: "Independent Contractor Engagement Template",
    version: "0.1.0",
    effectiveDate: "2026-08-06",
    status: "draft",
    path: "/legal/independent-contractor-template",
  },
};

/**
 * The three business relationships ProcessPilot Technologies can have
 * with an organization — kept as a single shared vocabulary so the
 * SaaS product, the professional-services terms, and (Phase 31A) any
 * client-engagement content all use the same three labels rather than
 * inventing overlapping ones. An organization can hold more than one
 * relationship type at once (e.g. a professional-services client that
 * later also becomes a SaaS customer).
 */
export type ClientRelationshipType =
  "saas_customer" | "professional_services_client" | "independent_contract_engagement";

export function relationshipTypeLabel(type: ClientRelationshipType): string {
  switch (type) {
    case "saas_customer":
      return "ProcessPilot SaaS customer";
    case "professional_services_client":
      return "Professional services client";
    case "independent_contract_engagement":
      return "Independent contract engagement";
  }
}

export function statusLabel(status: LegalDocumentStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "internal_review":
      return "Internal review";
    case "attorney_review_pending":
      return "Attorney review pending";
    case "approved":
      return "Approved";
  }
}

/**
 * Subprocessors actually wired into this codebase, per each provider
 * adapter's own `is*Configured()` check — never a fabricated vendor.
 * `configured` reflects this *environment*, not a claim that the
 * production environment does or doesn't have the credential set.
 */
export const subprocessors: {
  name: string;
  purpose: string;
  location: string;
  dataCategories: string[];
}[] = [
  {
    name: "Clerk",
    purpose: "Authentication, session management, and organization membership.",
    location: "United States",
    dataCategories: ["Account credentials", "Email address", "Name"],
  },
  {
    name: "Supabase (PostgreSQL + Storage)",
    purpose:
      "Primary application database and private file storage (evidence, knowledge documents).",
    location: "United States",
    dataCategories: ["Organization data", "Uploaded files", "Audit records"],
  },
  {
    name: "Vercel",
    purpose: "Application hosting, edge network, and scheduled job execution.",
    location: "United States",
    dataCategories: ["Request logs", "Application runtime data"],
  },
  {
    name: "Stripe",
    purpose: "Billing, subscription management, and payment processing.",
    location: "United States",
    dataCategories: ["Billing contact information", "Subscription/plan data"],
  },
  {
    name: "Resend",
    purpose: "Transactional email delivery (notifications, invitations).",
    location: "United States",
    dataCategories: ["Email address", "Notification content"],
  },
  {
    name: "Anthropic",
    purpose: "AI copilot features (grounded Q&A, drafting, summarization), when configured.",
    location: "United States",
    dataCategories: ["Organization content submitted to AI features, when used"],
  },
];
