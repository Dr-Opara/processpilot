import type { Metadata } from "next";
import "./globals.css";
import { Inter, IBM_Plex_Mono, Libre_Baskerville } from "next/font/google";

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
  title: "ProcessPilot",
  description: "A calm operating system for repeatable business work.",
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
