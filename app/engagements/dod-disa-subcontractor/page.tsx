import type { Metadata } from "next";
import { DodDisaSubcontractorPage } from "../../site";

export const metadata: Metadata = {
  title: "Sub Contractor | DoD/DISA | ProcessPilot Technologies",
  description: "Artificial Intelligence engineering and emerging technology support focused on secure GenAI, agentic AI, RAG, AI/ML evaluation, AI security, and operational deployment in DoD mission environments.",
};

export default function Page() {
  return <DodDisaSubcontractorPage />;
}
