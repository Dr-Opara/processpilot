import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

// No canonical/OpenGraph metadata here (unlike marketing pages) — this
// screen is only reachable behind app.processpilot.com or /app, isn't
// indexed, and has no shareable social-preview purpose.
export const metadata: Metadata = {
  title: "Sign in | ProcessPilot",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return <SignIn />;
}
