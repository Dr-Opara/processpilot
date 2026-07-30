import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { LegalContent } from "@/components/marketing/LegalContent";
import { buildMetadata } from "@/lib/seo";
import { LEGAL_DOCUMENTS } from "@/content/legal";

const doc = LEGAL_DOCUMENTS.professionalServicesTerms;

export const metadata: Metadata = buildMetadata({
  title: doc.title,
  description:
    "Terms governing professional-services and consulting engagements, separate from the ProcessPilot SaaS Terms of Service.",
  path: doc.path,
});

const sections = [
  {
    heading: "Scope — separate from the SaaS Terms of Service",
    body: [
      "These terms govern professional-services and independent contract engagements delivered by ProcessPilot Technologies — AI, cybersecurity, compliance, and custom project work performed under a signed Statement of Work (SOW) or engagement letter.",
      "They are distinct from the ProcessPilot SaaS Terms of Service. An organization receiving professional services from ProcessPilot Technologies is not, by virtue of that relationship alone, a ProcessPilot SaaS customer, and vice versa. See 'Relationship types' below.",
    ],
  },
  {
    heading: "Relationship types",
    body: [
      "ProcessPilot Technologies works with organizations in up to three distinct capacities, which may overlap: (1) SaaS customer — an organization with an active ProcessPilot subscription, governed by the Terms of Service; (2) Professional services client — an organization receiving consulting, advisory, or project-based services, governed by these terms and a specific SOW; (3) Independent contract engagement — a bounded, project-specific engagement, often with a public- or private-sector client, governed by these terms and its own engagement letter.",
      "An organization's relationship type(s) are tracked explicitly per engagement, never inferred, and never presented publicly as more than what has actually occurred.",
    ],
  },
  {
    heading: "Statement of Work governs scope",
    body: [
      "Each engagement is governed by a signed Statement of Work (see the SOW template) or, for individual engagements, an Independent Contractor Engagement letter (see that template). These terms apply as the general framework; the SOW controls scope, deliverables, timeline, and fees for a specific engagement.",
    ],
  },
  {
    heading: "Confidentiality",
    body: [
      "Each party agrees to protect the other's confidential information disclosed during an engagement, using at least the same care it uses for its own confidential information, and not to disclose it except as required to perform the engagement or as required by law.",
      "Client-specific technical details, findings, credentials, and non-public documentation are treated as confidential by default unless a client explicitly designates otherwise in writing.",
    ],
  },
  {
    heading: "Publication and case-study approval",
    body: [
      "ProcessPilot Technologies will not publish a client's name, logo, or any description of the engagement — including an anonymized description that could reasonably identify the client — without that client's prior written approval.",
      "Approval is tracked per engagement (approval date and approver) before any public-facing content referencing that client is published. See docs/operations/publication-approval-process.md for the internal process this implements.",
    ],
  },
  {
    heading: "Intellectual property",
    body: [
      "Each party retains ownership of its pre-existing intellectual property (background IP) brought into an engagement.",
      "Unless the applicable SOW states otherwise, work product created specifically for a client under a paid engagement is owned by that client upon full payment; ProcessPilot Technologies retains a license to reuse general methodologies, know-how, and non-client-specific tooling developed in the course of delivering it.",
    ],
  },
  {
    heading: "Logo and name use",
    body: [
      "Use of a client's name or logo in any marketing material, case study, or engagement page requires separate, explicit, written permission from that client — approval to publish a text description of an engagement does not itself authorize logo or trademark use.",
    ],
  },
  {
    heading: "No SaaS terms implied",
    body: [
      "A professional-services engagement does not create, imply, or include a ProcessPilot SaaS subscription. If a professional-services client separately subscribes to ProcessPilot, that subscription is governed by the Terms of Service and, if applicable, a separate SaaS Data Processing Addendum — not these terms.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about professional-services engagements can be sent to services@useprocesspilot.com.",
    ],
  },
];

export default function ProfessionalServicesTermsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <LegalContent
          title={doc.title}
          updated={doc.effectiveDate}
          version={doc.version}
          status={doc.status}
          intro="Terms governing AI, cybersecurity, compliance, and custom project engagements — distinct from the ProcessPilot SaaS Terms of Service."
          sections={sections}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
