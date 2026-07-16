import type { SolutionPageContent } from "@/content/types";

export const operationsSolutionContent: SolutionPageContent = {
  seo: {
    title: "Operations — standardized execution and work visibility",
    description:
      "Standardize how work gets done across teams and locations, manage exceptions, and see process performance in one place.",
    path: "/solutions/operations",
  },
  eyebrow: "Solutions for Operations",
  headline: "Run the same process the same way, everywhere",
  intro:
    "Operations leaders need consistent execution across teams and locations, without losing visibility into where things go wrong.",
  accent: "cobalt",
  audience: "operations leaders managing execution across teams or sites",
  challenges: [
    {
      title: "Execution varies by team",
      description:
        "The same process runs differently depending on who's doing it, with no shared record of the correct version.",
    },
    {
      title: "Exceptions pile up invisibly",
      description:
        "Work that falls outside the standard path gets handled ad hoc, with no pattern tracking.",
    },
    {
      title: "Performance data is scattered",
      description:
        "Comparing throughput or quality across teams means assembling separate reports.",
    },
  ],
  capabilities: [
    {
      title: "Standardized execution",
      description:
        "One published workflow per process, followed the same way by every team assigned to it.",
    },
    {
      title: "Work visibility",
      description:
        "See what's in progress, what's blocked, and what's overdue without asking for a status update.",
    },
    {
      title: "Exception management",
      description:
        "Route work that doesn't fit the standard path to a defined owner, with the resolution recorded.",
    },
    {
      title: "Process performance",
      description:
        "Completion rates, exception volume, and bottlenecks visible per workflow and team.",
    },
  ],
  workflowExample: {
    title: "Standardizing a maintenance-request process",
    steps: [
      {
        title: "Import the current procedure",
        description: "Operations imports the existing maintenance-request SOP.",
      },
      {
        title: "Publish one workflow",
        description: "A single workflow is published for all three locations.",
      },
      {
        title: "Track exceptions",
        description:
          "Vendor-unavailable cases are routed and tracked as exceptions.",
      },
      {
        title: "Compare performance",
        description:
          "Analytics show which location resolves requests fastest, and why.",
      },
    ],
  },
  outcomes: [
    "One current version of each process, not three",
    "Exceptions have an owner and a visible resolution",
    "Performance comparisons take minutes, not a status meeting",
    "New locations onboard onto an existing standard instead of writing their own",
  ],
  related: [
    {
      label: "Workflow execution",
      href: "/product/workflow-execution",
      description: "How employees experience a standardized workflow.",
    },
    {
      label: "Exceptions",
      href: "/product/exceptions",
      description: "How exceptions are routed and resolved.",
    },
    {
      label: "Multi-location",
      href: "/solutions/multi-location",
      description: "Managing one operating model across many sites.",
    },
  ],
  cta: {
    title: "Standardize your highest-friction process first",
    description:
      "Most operations teams start with the process that generates the most exceptions today.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
