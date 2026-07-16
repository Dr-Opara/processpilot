import type { ProductPageContent } from "@/content/types";

export const analyticsContent: ProductPageContent = {
  seo: {
    title: "Analytics — see where operational work slows down",
    description:
      "See completion rates, exception volume, and bottlenecks across workflows and locations, backed by evidence instead of anecdotes.",
    path: "/product/analytics",
  },
  eyebrow: "Improve operations",
  headline: "See where the process breaks down, not just that it did",
  intro:
    "Analytics turns workflow activity into a record of where work slows down, where exceptions cluster, and which locations are ahead or behind.",
  accent: "cobalt",
  layout: "governance-first",
  problem: {
    title: "Process problems get discovered too late",
    description:
      "Without workflow-level data, a slow or broken process is usually discovered anecdotally, after it's already caused a problem.",
    points: [
      "No visibility into where a workflow typically stalls",
      "Exception patterns go unnoticed until someone complains",
      "Comparing performance across locations means chasing down separate reports",
      "Process owners publish changes without evidence the old version was struggling",
    ],
  },
  capability: {
    title: "Workflow-level performance data",
    description:
      "Every published workflow generates data on completion time, exception rate, and where handoffs stall, broken down by location and role.",
    bullets: [
      "Completion rate and average duration per workflow",
      "Exception volume and common causes",
      "Comparative view across locations and departments",
      "Bottleneck identification at the individual task level",
    ],
  },
  workflowExample: {
    title: "Reviewing onboarding performance across three locations",
    steps: [
      {
        title: "Open the onboarding workflow report",
        description: "A process owner opens the analytics view for onboarding.",
      },
      {
        title: "Compare completion rates",
        description:
          "Houston and Austin complete on time more often than Dallas.",
      },
      {
        title: "Identify the stalled task",
        description:
          "Dallas onboarding stalls most often at the equipment-provisioning task.",
      },
      {
        title: "Route the finding to the process owner",
        description:
          "The finding is flagged for a workflow revision in process builder.",
      },
    ],
  },
  roles: [
    {
      role: "Process owner",
      description:
        "Uses workflow data to decide what to change in the next published version.",
    },
    {
      role: "Manager",
      description:
        "Compares team performance against other locations or departments.",
    },
    {
      role: "Executive",
      description:
        "Sees completion rates and exception volume across the whole company.",
    },
  ],
  uiDemo: {
    title: "Workflow analytics",
    tags: ["Completion rate", "Exceptions", "By location", "Bottlenecks"],
  },
  governance: {
    title: "Data reflects actual recorded activity",
    points: [
      "Metrics are calculated from completed and in-progress workflow tasks",
      "No manually entered or estimated figures",
      "Reports can be filtered by location, department, or workflow version",
    ],
  },
  related: [
    {
      label: "Exceptions",
      href: "/product/exceptions",
      description: "Where exception data shown in analytics originates.",
    },
    {
      label: "Audit center",
      href: "/product/audit-center",
      description: "Pull the evidence behind any metric shown in a report.",
    },
    {
      label: "Multi-location solution",
      href: "/solutions/multi-location",
      description:
        "How comparative analytics support a multi-location operating model.",
    },
  ],
  cta: {
    title: "Find the bottleneck before it becomes a pattern",
    description:
      "See workflow performance data across your locations and departments.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
