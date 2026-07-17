import type { IndustryPageContent } from "@/content/types";

export const logisticsContent: IndustryPageContent = {
  seo: {
    title: "Logistics — dispatch, receiving, and safety procedures at scale",
    description:
      "Standardize dispatch, receiving, and safety procedures across facilities with workflows that track evidence and exceptions.",
    path: "/industries/logistics",
  },
  eyebrow: "Logistics",
  headline: "Dispatch and safety procedures that run the same way at every facility",
  intro:
    "Logistics operations depend on dispatch, receiving, and safety procedures being followed exactly, every shift, at every facility — not just when a supervisor is watching.",
  accent: "warning",
  disclaimer:
    "ProcessPilot is operational workflow software. It does not provide DOT, OSHA, or other regulatory compliance certification, and following a workflow does not by itself guarantee regulatory compliance.",
  challenges: [
    {
      title: "Shift handoffs lose information",
      description:
        "Details from one shift don't reliably reach the next, leading to repeated questions and missed follow-up.",
    },
    {
      title: "Safety procedures aren't consistently followed",
      description:
        "Without a tracked workflow, safety checklist steps get skipped under time pressure.",
    },
    {
      title: "Receiving discrepancies are hard to trace",
      description:
        "When a shipment discrepancy is found later, tracing back which shift and which step caused it takes real effort.",
    },
  ],
  workflows: [
    {
      title: "Dispatch procedures",
      description: "A consistent dispatch workflow with handoff notes carried to the next shift.",
    },
    {
      title: "Receiving and inspection",
      description:
        "Structured intake with evidence capture for discrepancies at the point they occur.",
    },
    {
      title: "Safety checklists",
      description: "Required safety steps tracked as tasks, not a paper form that can be skipped.",
    },
  ],
  whoUses: [
    {
      role: "Facility supervisor",
      description: "Oversees shift execution and reviews handoff notes.",
    },
    {
      role: "Dispatcher",
      description: "Runs the dispatch workflow for each shift.",
    },
    {
      role: "Safety and compliance lead",
      description: "Reviews safety checklist completion across facilities.",
    },
  ],
  lifecycle: [
    {
      title: "Import",
      description: "Existing dispatch and safety procedures are imported.",
    },
    {
      title: "Publish",
      description: "A safety lead reviews and publishes the standard workflow.",
    },
    {
      title: "Run",
      description: "Each shift executes the workflow at every facility.",
    },
    {
      title: "Review",
      description: "Completion and exception data drive the next revision.",
    },
  ],
  templates: [
    {
      name: "Shift handoff checklist",
      description: "A structured handoff workflow carrying notes to the next shift.",
    },
    {
      name: "Receiving discrepancy report",
      description: "An evidence-capture workflow triggered at the point a discrepancy is found.",
    },
  ],
  related: [
    {
      label: "Operations solution",
      href: "/solutions/operations",
      description: "The broader case for standardized execution.",
    },
    {
      label: "Exceptions",
      href: "/product/exceptions",
      description: "How discrepancies and safety exceptions are routed.",
    },
    {
      label: "Multi-location solution",
      href: "/solutions/multi-location",
      description: "One operating model across every facility.",
    },
  ],
  cta: {
    title: "Make your safety checklist a tracked workflow",
    description: "See how a shift handoff and safety checklist run the same way at every facility.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
