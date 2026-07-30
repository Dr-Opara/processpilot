import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { LegalContent } from "@/components/marketing/LegalContent";
import { buildMetadata } from "@/lib/seo";
import { LEGAL_DOCUMENTS } from "@/content/legal";

const doc = LEGAL_DOCUMENTS.privacy;

export const metadata: Metadata = buildMetadata({
  title: doc.title,
  description: "How ProcessPilot collects, uses, stores, and protects information.",
  path: doc.path,
});

const sections = [
  {
    heading: "What this covers",
    body: [
      "This policy describes how ProcessPilot collects, uses, and protects information — both through this website's marketing forms and through the ProcessPilot application once you create an account.",
    ],
  },
  {
    heading: "Information we collect",
    body: [
      "Account information: name, email address, and organization membership, collected when you sign up (via Clerk, our authentication provider) or are invited to an organization.",
      "Organization content: whatever your organization stores in ProcessPilot — processes, workflows, tasks, forms, evidence files, exceptions, training records, and related metadata. This belongs to your organization, not to us.",
      "Usage and audit data: records of actions taken in the product (who did what, when) for security and compliance purposes — see our audit log feature.",
      "Marketing form submissions: the request-demo and start-trial forms on this website. In this development phase, these submissions are validated but not persisted, and no email is triggered.",
    ],
  },
  {
    heading: "How we use information",
    body: [
      "To provide and operate the ProcessPilot service for your organization.",
      "To send transactional notifications (task assignments, approval requests, deadline reminders) when notification delivery is configured for your organization.",
      "To process payment for paid plans, through Stripe.",
      "To provide AI-assisted features (grounded Q&A, drafting, summarization), only when your organization has enabled them — see our AI architecture documentation for the governance boundaries this is subject to.",
    ],
  },
  {
    heading: "Tenant isolation",
    body: [
      "Your organization's data is isolated from every other organization's data at both the application and database layer — see the Security page for how this is designed and enforced.",
    ],
  },
  {
    heading: "Subprocessors",
    body: [
      "We use a small number of subprocessors to operate ProcessPilot (authentication, hosting, database, billing, email, and AI providers). See our Subprocessors page for the current list and what each one is used for.",
    ],
  },
  {
    heading: "Your rights and choices",
    body: [
      "Access and correction: organization members can view and correct their own profile information from within the application; organization admins can manage member records.",
      "Export: an organization admin can request an export of the organization's audit history from the audit center, and can request a broader data export by contacting privacy@useprocesspilot.com.",
      "Deletion: an organization owner can request organization deletion from Organization Settings, which starts a 14-day grace period during which the request can be cancelled before anything is removed.",
      "Individual member removal (without deleting the whole organization) is available to organization admins from the People section.",
    ],
  },
  {
    heading: "Data retention",
    body: [
      "Audit events are retained indefinitely by default for compliance purposes (they are immutable once recorded). Organization admins can configure retention preferences for audit, evidence, and exception data from Organization Settings; note these preferences are currently stored but not yet enforced by an automatic purge process.",
    ],
  },
  {
    heading: "No certifications claimed",
    body: [
      "ProcessPilot does not claim SOC 2, ISO 27001, FedRAMP, or HIPAA certification, authorization, or independent validation. See the Security page.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about this policy, or requests regarding your data, can be sent to privacy@useprocesspilot.com.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <LegalContent
          title={doc.title}
          updated={doc.effectiveDate}
          version={doc.version}
          status={doc.status}
          intro="This page explains what information ProcessPilot collects, how it's used, and how to exercise your rights over it."
          sections={sections}
        />
        <div className="mx-auto max-w-3xl px-6 pb-16 text-sm text-muted">
          Related:{" "}
          <Link href="/legal/subprocessors" className="text-cobalt">
            Subprocessors
          </Link>
          {" · "}
          <Link href="/legal/acceptable-use" className="text-cobalt">
            Acceptable Use Policy
          </Link>
          {" · "}
          <Link href="/legal/dpa" className="text-cobalt">
            Data Processing Addendum
          </Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
