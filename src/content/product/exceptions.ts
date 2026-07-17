import type { ProductPageContent } from "@/content/types";

export const exceptionsContent: ProductPageContent = {
  seo: {
    title: "Exceptions — route and resolve work outside the standard path",
    description:
      "Give work that falls outside a standard workflow a clear owner and a resolution path, instead of letting it sit unresolved.",
    path: "/product/exceptions",
  },
  eyebrow: "Guide employees",
  headline: "Not every case fits the standard path. Give it one anyway.",
  intro:
    "Even a well-designed workflow hits cases it didn't anticipate. Exceptions gives that work a clear owner and a resolution path instead of letting it stall.",
  accent: "warning",
  layout: "workflow-first",
  problem: {
    title: "Exceptions become invisible work",
    description:
      "When a case doesn't fit the standard workflow, it gets handled over email or Slack, with no record of how it was resolved or by whom.",
    points: [
      "No visibility into how many exceptions are happening or why",
      "Resolution depends on whoever happens to see the message first",
      "The same exception recurs because no one connects the pattern",
      "No record for compliance if the exception involved an approval",
    ],
  },
  capability: {
    title: "A routed path for the unexpected",
    description:
      "When a workflow can't proceed on the standard path, it's routed to the right person with full context, and the resolution is recorded.",
    bullets: [
      "Automatic routing to a defined exception owner",
      "Full context carried over from the original task",
      "Resolution recorded as evidence on the original workflow",
      "Exception volume and reasons visible in analytics",
    ],
  },
  workflowExample: {
    title: "Handling a maintenance request with no assigned vendor",
    steps: [
      {
        title: "Standard path blocked",
        description: "A maintenance request comes in for a repair type with no assigned vendor.",
      },
      {
        title: "Routed as an exception",
        description: "The task routes automatically to the regional Operations manager.",
      },
      {
        title: "Manager resolves manually",
        description: "The manager assigns a one-off vendor and adds a note.",
      },
      {
        title: "Resolution recorded",
        description: "The exception and its resolution are attached to the original request.",
      },
    ],
  },
  roles: [
    {
      role: "Manager",
      description: "Resolves exceptions routed from their team's workflows.",
    },
    {
      role: "Process owner",
      description: "Reviews recurring exceptions to decide if the workflow needs a new branch.",
    },
    {
      role: "Executive",
      description: "Sees exception volume as a signal of where a process is breaking down.",
    },
  ],
  uiDemo: {
    title: "Exception queue",
    tags: ["Routed", "In review", "Resolved", "Recurring"],
  },
  governance: {
    title: "Every exception leaves a record",
    points: [
      "Exceptions are timestamped and attributed to a resolver",
      "Resolution notes are retained with the original workflow",
      "Recurring exception types are surfaced for workflow redesign",
    ],
  },
  related: [
    {
      label: "Workflow execution",
      href: "/product/workflow-execution",
      description: "How a task ends up routed as an exception.",
    },
    {
      label: "Analytics",
      href: "/product/analytics",
      description: "Where exception volume shows up as an operational signal.",
    },
    {
      label: "Process builder",
      href: "/product/process-builder",
      description: "Turn a recurring exception into a new conditional branch.",
    },
  ],
  cta: {
    title: "Stop losing exceptions in email threads",
    description:
      "Give work that falls outside the standard path a visible, recorded resolution path.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
