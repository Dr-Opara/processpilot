import type { Metadata } from "next";
import "./globals.css";
import { Inter, IBM_Plex_Mono, Libre_Baskerville } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { getSiteUrl, SITE_NAME } from "@/lib/seo";
import { clerkAppearance } from "@/lib/clerk-appearance";

const sans = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
});
const serif = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-source-serif-4",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "ProcessPilot converts policies, SOPs, and institutional knowledge into guided workflows, role-based training, approvals, evidence, and operational insight.",
};

// Fixed /app/* paths rather than host-detected ones: computing them would
// require reading headers() in this root layout, which wraps every
// marketing page too and would force the entire static marketing site into
// dynamic rendering just for this. No custom domain is configured yet
// (see middleware.ts), so the only cost of a fixed path today is a
// redundant "/app" segment remaining in the URL if this is ever reached
// through a real app.processpilot.com host — cosmetic, not functional.
const SIGN_IN_URL = "/app/sign-in";
const SIGN_UP_URL = "/app/sign-up";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInUrl={SIGN_IN_URL}
      signUpUrl={SIGN_UP_URL}
      afterSignOutUrl={SIGN_IN_URL}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${sans.variable} ${mono.variable} ${serif.variable} min-h-screen bg-paper text-ink antialiased`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
