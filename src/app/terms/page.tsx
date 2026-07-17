import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { LegalContent } from "@/components/marketing/LegalContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description: "Terms for using the current version of the ProcessPilot website.",
  path: "/terms",
});

const sections = [
  {
    heading: "What this covers",
    body: [
      "These terms cover use of the current version of the ProcessPilot website, including its marketing pages and development-mode forms.",
    ],
  },
  {
    heading: "No production service yet",
    body: [
      "ProcessPilot does not yet offer a production account, workflow execution, or data storage service. Submitting the start-trial or request-demo forms does not create an account or a contractual relationship.",
      "Features described on this site, including product pages and pricing, describe the intended product and may change before general availability.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Do not use this website to submit unlawful, abusive, or fraudulent content, or to attempt to disrupt or gain unauthorized access to the site.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "These terms will be replaced with a complete service agreement before general availability. We'll provide notice before that change takes effect.",
    ],
  },
  {
    heading: "Contact",
    body: ["Questions about these terms can be sent to legal@processpilot.com."],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <LegalContent
          title="Terms of Service"
          updated="July 2026"
          intro="ProcessPilot is in early development. These terms cover the current, pre-release version of this website."
          sections={sections}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
