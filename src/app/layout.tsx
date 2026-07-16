import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProcessPilot",
  description: "The operating system for repeatable business work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
