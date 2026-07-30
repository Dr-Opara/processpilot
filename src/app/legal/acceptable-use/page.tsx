import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { LegalContent } from "@/components/marketing/LegalContent";
import { buildMetadata } from "@/lib/seo";
import { LEGAL_DOCUMENTS } from "@/content/legal";

const doc = LEGAL_DOCUMENTS.acceptableUse;

export const metadata: Metadata = buildMetadata({
  title: doc.title,
  description: "What is and isn't allowed when using ProcessPilot.",
  path: doc.path,
});

const sections = [
  {
    heading: "Purpose",
    body: [
      "This policy describes uses of ProcessPilot that are prohibited, to keep the service safe, reliable, and lawful for every organization using it.",
    ],
  },
  {
    heading: "Prohibited uses",
    body: [
      "Attempting to access, scrape, or infer data belonging to an organization you are not a member of.",
      "Attempting to bypass, disable, or probe authentication, authorization, or rate-limiting controls.",
      "Uploading malicious files, or files intended to exploit a vulnerability in the service.",
      "Using the service to store or transmit unlawful, infringing, or fraudulent content.",
      "Reverse engineering the service except to the extent applicable law expressly permits.",
      "Reselling or providing the service to third parties without our prior written agreement.",
      "Using AI-assisted features to generate content for a purpose the product's own governance boundaries are designed to prevent (e.g. attempting to have the AI copilot autonomously approve, publish, or close a governance record — this is structurally blocked, not just discouraged).",
      "Interfering with or disrupting the service for other customers, including excessive automated requests outside documented API rate limits.",
    ],
  },
  {
    heading: "Security research",
    body: [
      "If you believe you've found a security vulnerability, please report it responsibly per our Security page rather than testing it against another organization's data. Good-faith security research conducted within those guidelines will not be treated as a violation of this policy.",
    ],
  },
  {
    heading: "Enforcement",
    body: [
      "Violations may result in suspension or termination of access, at our discretion, with notice where practical.",
    ],
  },
  {
    heading: "Contact",
    body: ["Questions about this policy can be sent to legal@useprocesspilot.com."],
  },
];

export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <LegalContent
          title={doc.title}
          updated={doc.effectiveDate}
          version={doc.version}
          status={doc.status}
          intro="What is and isn't allowed when using ProcessPilot."
          sections={sections}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
