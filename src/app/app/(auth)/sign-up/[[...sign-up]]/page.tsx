import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Start your trial | ProcessPilot",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return <SignUp />;
}
