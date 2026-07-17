import type { SolutionPageContent } from "@/content/types";

export const multiLocationSolutionContent: SolutionPageContent = {
  seo: {
    title: "Multi-location — one operating model, applied everywhere",
    description:
      "Run a standard operating model across every location with room for local rules, backed by central oversight and comparative analytics.",
    path: "/solutions/multi-location",
  },
  eyebrow: "Solutions for Multi-location operators",
  headline: "One standard, applied consistently across every site",
  intro:
    "Companies running the same operation across multiple locations need a shared standard that still allows for legitimate local differences.",
  accent: "cobalt",
  audience: "operators running multiple locations or franchise-style sites",
  challenges: [
    {
      title: "Every location writes its own version",
      description:
        "Without a shared source, each location's process drifts from the others over time.",
    },
    {
      title: "Central teams lack oversight",
      description:
        "Headquarters can't see how consistently a process is actually being followed across sites.",
    },
    {
      title: "Comparing locations is manual",
      description: "There's no fast way to see which sites are ahead or behind on a given process.",
    },
  ],
  capabilities: [
    {
      title: "Standard operating models",
      description: "A central process owner publishes one workflow that every location runs from.",
    },
    {
      title: "Location-specific rules",
      description:
        "Conditional branches handle legitimate local differences without forking the whole workflow.",
    },
    {
      title: "Central oversight",
      description:
        "Headquarters sees adoption and completion rates across every location in one view.",
    },
    {
      title: "Comparative analytics",
      description:
        "Compare performance across locations to find what the fastest sites are doing differently.",
    },
  ],
  workflowExample: {
    title: "Rolling out onboarding across three locations",
    steps: [
      {
        title: "Publish the central workflow",
        description: "Onboarding is published once, for Houston, Dallas, and Austin.",
      },
      {
        title: "Local branch added",
        description: "Austin adds a conditional step for a state-specific tax form.",
      },
      {
        title: "Rollout tracked centrally",
        description: "Adoption is tracked as each location's first cohort completes onboarding.",
      },
      {
        title: "Performance compared",
        description: "Analytics show Dallas onboarding running slower than the other two sites.",
      },
    ],
  },
  outcomes: [
    "One published version instead of three local variants",
    "Local exceptions are handled without forking the workflow",
    "Central teams see adoption without visiting each site",
    "Underperforming locations are identified early, with specifics",
  ],
  related: [
    {
      label: "Analytics",
      href: "/product/analytics",
      description: "How comparative performance across locations is measured.",
    },
    {
      label: "Process builder",
      href: "/product/process-builder",
      description: "How conditional branches handle location-specific rules.",
    },
    {
      label: "Franchises",
      href: "/industries/franchises",
      description: "How this model applies to franchise operators specifically.",
    },
  ],
  cta: {
    title: "Bring every location onto one operating model",
    description:
      "See how a single published workflow scales across multiple sites with room for local rules.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
