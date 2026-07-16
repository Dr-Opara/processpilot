import type { Metadata } from "next";
import "./globals.css";
import { Inter, IBM_Plex_Mono, Libre_Baskerville } from "next/font/google";
import { getSiteUrl, SITE_NAME } from "@/lib/seo";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${mono.variable} ${serif.variable} min-h-screen bg-paper text-ink antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
