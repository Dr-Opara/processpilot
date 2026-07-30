import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { LegalContent } from "@/components/marketing/LegalContent";
import { buildMetadata } from "@/lib/seo";
import { LEGAL_DOCUMENTS } from "@/content/legal";

const doc = LEGAL_DOCUMENTS.terms;

export const metadata: Metadata = buildMetadata({
  title: doc.title,
  description: "Terms governing use of the ProcessPilot application and website.",
  path: doc.path,
});

const sections = [
  {
    heading: "What this covers",
    body: [
      "These terms cover use of the ProcessPilot website and application, including account creation, organization workspaces, and every feature area of the product (process authoring, workflow execution, forms and evidence, exceptions, training, analytics, audit, notifications, billing, integrations, and administration).",
    ],
  },
  {
    heading: "Accounts and organizations",
    body: [
      "Creating an account requires signing up through our authentication provider (Clerk). An organization is a separate, isolated workspace — your organization's data is never visible to another organization.",
      "The person who creates an organization is its initial owner and can invite other members, assign roles, and manage settings, subject to the permissions described in the product.",
    ],
  },
  {
    heading: "Subscriptions and billing",
    body: [
      "Paid plans are billed through Stripe. Pricing shown on this site reflects working hypotheses, not committed, contractually binding pricing, until explicitly stated otherwise on an order form or invoice.",
      "You can cancel or change your plan from the billing section of the application; changes take effect per the terms shown at the time of the change.",
    ],
  },
  {
    heading: "Your data",
    body: [
      "You own the data your organization submits to ProcessPilot. We process it to provide the service, as described in our Privacy Policy.",
      "You can request an export of your organization's data or request account/organization deletion at any time — see the Privacy Policy's 'Your rights and choices' section for how.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Do not use ProcessPilot to store or process unlawful content, to attempt to access another organization's data, to circumvent rate limits or security controls, or to disrupt the service for other customers. See our Acceptable Use Policy for the full list.",
    ],
  },
  {
    heading: "Service availability",
    body: [
      "ProcessPilot is under active development. We do not currently offer a formal service-level agreement (SLA); this will be addressed in a customer order form once available for organizations that need one.",
    ],
  },
  {
    heading: "No certifications claimed",
    body: [
      "ProcessPilot does not claim SOC 2, ISO 27001, FedRAMP, or HIPAA certification, authorization, or independent validation. See the Security page for what is and isn't true today.",
    ],
  },
  {
    heading: "Changes to these terms",
    body: [
      "We may update these terms as the product changes. Material changes will be reflected in the version and effective date shown at the top of this page.",
    ],
  },
  {
    heading: "Contact",
    body: ["Questions about these terms can be sent to legal@useprocesspilot.com."],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <LegalContent
          title={doc.title}
          updated={doc.effectiveDate}
          version={doc.version}
          status={doc.status}
          intro="These terms cover use of the ProcessPilot application, including account creation, organization workspaces, and every implemented feature area."
          sections={sections}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
