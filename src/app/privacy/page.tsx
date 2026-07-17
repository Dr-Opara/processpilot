import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { LegalContent } from "@/components/marketing/LegalContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: "How ProcessPilot handles information submitted through this website.",
  path: "/privacy",
});

const sections = [
  {
    heading: "What this covers",
    body: [
      "This policy describes how ProcessPilot handles information submitted through the current version of this website, including the request-demo, start-trial, and sign-in forms.",
    ],
  },
  {
    heading: "Current data handling",
    body: [
      "The forms on this site run in development mode. Submissions are validated for format but are not saved to a database, and no email is sent as a result of submitting them.",
      "No real user accounts, passwords, or organization data are created or stored by this version of the site.",
    ],
  },
  {
    heading: "What will change at general availability",
    body: [
      "Once account creation and data storage are implemented, this policy will be updated to describe what's collected, how it's used, how long it's retained, and how to request access, correction, or deletion.",
    ],
  },
  {
    heading: "Contact",
    body: ["Questions about this policy can be sent to privacy@processpilot.com."],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <LegalContent
          title="Privacy Policy"
          updated="July 2026"
          intro="ProcessPilot is in early development. This page explains what actually happens to information submitted through this site today."
          sections={sections}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
