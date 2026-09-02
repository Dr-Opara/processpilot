import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://processpilottech.com"),
  title: {
    default: "ProcessPilot | AI, Cybersecurity & Technology Consulting",
    template: "%s | ProcessPilot",
  },
  description:
    "AI, cybersecurity, engineering, and technology consulting for secure AI systems, compliance, workflow automation, and resilient operations.",
  openGraph: {
    title: "ProcessPilot",
    description: "Strategy, engineering, and security for intelligent, resilient organizations.",
    type: "website",
    siteName: "ProcessPilot",
  },
  robots: { index: true, follow: true },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
