import type { Metadata } from "next";
import { AgeSolutionsPage } from "../../site";

export const metadata: Metadata = {
  title: "AGE Solutions | DoD / DISA | ProcessPilot Technologies",
  description: "Artificial Intelligence engineering and emerging technology support focused on secure GenAI, agentic AI, RAG, AI/ML evaluation, AI security, and operational deployment in DoD mission environments.",
};

export default function Page() {
  return <AgeSolutionsPage />;
}
