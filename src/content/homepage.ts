import type { FaqItem } from "./types";

export const homepageFaqs: FaqItem[] = [
  {
    question: "Do we have to move every process into ProcessPilot at once?",
    answer:
      "No. Most teams start with one high-friction process — onboarding is a common first choice — publish it, and expand from there once it's working.",
  },
  {
    question: "Who writes the first draft of a workflow?",
    answer:
      "ProcessPilot proposes a draft from an uploaded document. A process owner reviews, edits, and publishes it — the draft is a starting point, not the final version.",
  },
  {
    question: "Can different locations run the process differently?",
    answer:
      "Yes, within limits the process owner defines. A central workflow can include location-specific steps or conditional branches instead of forking into separate processes.",
  },
  {
    question: "What happens to approvals and evidence we already collect?",
    answer:
      "Approvals and evidence (uploads, sign-offs, confirmations) are captured as part of the workflow itself, so they're attached to the task instead of living in a separate system.",
  },
  {
    question: "Is this a replacement for our HRIS or ticketing system?",
    answer:
      "No. ProcessPilot is where the procedure and the work happen. It's designed to sit alongside systems of record, not replace them.",
  },
];
