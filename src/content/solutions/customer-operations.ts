import type { SolutionPageContent } from "@/content/types";

export const customerOperationsSolutionContent: SolutionPageContent = {
  seo: {
    title: "Customer Operations — repeatable service processes",
    description:
      "Run customer-facing requests and escalations through repeatable workflows with built-in quality checks.",
    path: "/solutions/customer-operations",
  },
  eyebrow: "Solutions for Customer Operations",
  headline: "Give every customer request the same reliable process",
  intro:
    "Customer operations teams need service requests handled consistently, escalations routed correctly, and a way to catch quality issues before they repeat.",
  accent: "cobalt",
  audience: "customer operations and service delivery leaders",
  challenges: [
    {
      title: "Service quality depends on who picks up the request",
      description:
        "Without a shared workflow, the same request type gets handled differently by different team members.",
    },
    {
      title: "Escalations lack a clear path",
      description:
        "When a request needs to escalate, it's unclear who owns it next or how quickly it should move.",
    },
    {
      title: "Quality issues repeat",
      description:
        "Without tracking recurring problems, the same service failure happens again the next month.",
    },
  ],
  capabilities: [
    {
      title: "Repeatable service processes",
      description:
        "A published workflow defines each request type, so every customer gets the same handling.",
    },
    {
      title: "Escalations",
      description:
        "Requests that need to escalate route automatically to the right owner with full context.",
    },
    {
      title: "Customer-facing requests",
      description:
        "Intake, triage, and resolution steps are tracked from the moment a request comes in.",
    },
    {
      title: "Quality assurance",
      description:
        "Recurring issues are visible in analytics instead of surfacing only in complaints.",
    },
  ],
  workflowExample: {
    title: "Handling a maintenance escalation",
    steps: [
      {
        title: "Request submitted",
        description: "A tenant submits a maintenance request through the standard intake form.",
      },
      {
        title: "Standard path attempted",
        description: "The assigned vendor doesn't respond within the defined window.",
      },
      {
        title: "Escalation triggered",
        description: "The request routes automatically to a regional operations manager.",
      },
      {
        title: "Resolution recorded",
        description:
          "The manager resolves the issue and the outcome is logged against the request.",
      },
    ],
  },
  outcomes: [
    "Every request type follows the same defined process",
    "Escalations have a clear owner and a time expectation",
    "Recurring quality issues surface before they repeat again",
    "Response times are visible without pulling a manual report",
  ],
  related: [
    {
      label: "Exceptions",
      href: "/product/exceptions",
      description: "How escalations are routed and resolved.",
    },
    {
      label: "Analytics",
      href: "/product/analytics",
      description: "Where recurring quality issues become visible.",
    },
    {
      label: "Property management",
      href: "/industries/property-management",
      description: "How this applies to tenant and resident requests.",
    },
  ],
  cta: {
    title: "Standardize your highest-volume request type",
    description:
      "See how a service request moves from intake to resolution, with escalation handled automatically.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
