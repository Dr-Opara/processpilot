import type { ProductPageContent } from "@/content/types";

export const trainingContent: ProductPageContent = {
  seo: {
    title: "Training — role-based training tied to real workflows",
    description:
      "Assign training that's attached to the workflow it supports, so people learn a step right before they need to do it.",
    path: "/product/training",
  },
  eyebrow: "Guide employees",
  headline: "Training that's attached to the work, not a separate course",
  intro:
    "Training completed months before it's needed is training that's forgotten. Training in ProcessPilot is assigned in context, tied to the task it prepares someone for.",
  accent: "success",
  layout: "capability-first",
  problem: {
    title: "Training and execution live in different systems",
    description:
      "A course gets completed once, months before the skill is needed, in a system disconnected from the actual task.",
    points: [
      "No link between a completed course and the task it was meant to prepare someone for",
      "Certification expiry isn't tied to whether someone can still be assigned the work",
      "New hires complete generic training unrelated to their specific role",
      "Managers can't see who's actually qualified for a given task",
    ],
  },
  capability: {
    title: "Training tied to the workflow",
    description:
      "Assign a training module directly to a workflow step, so it's completed right before someone needs it, not months earlier.",
    bullets: [
      "Attach training to a specific task or role",
      "Track completion and certification expiry",
      "Block task assignment until required training is complete",
      "Role-based assignment instead of one course for everyone",
    ],
  },
  workflowExample: {
    title: "Assigning safety training to a maintenance workflow",
    steps: [
      {
        title: "Training attached to a task",
        description:
          "A safety-training module is attached to the 'enter occupied unit' task.",
      },
      {
        title: "Technician assigned the task",
        description:
          "A maintenance technician is assigned a work order requiring the task.",
      },
      {
        title: "Training required before task starts",
        description:
          "The task stays blocked until the technician completes the module.",
      },
      {
        title: "Completion recorded",
        description:
          "Completion is logged and tied to that technician's task history.",
      },
    ],
  },
  roles: [
    {
      role: "Employee",
      description: "Completes training right before the task that requires it.",
    },
    {
      role: "Manager",
      description:
        "Sees who on the team is currently qualified for a given task.",
    },
    {
      role: "Compliance",
      description:
        "Pulls certification records without chasing down a separate LMS.",
    },
  ],
  uiDemo: {
    title: "Training assignment",
    tags: ["Modules", "Certifications", "Expiry", "Blocked tasks"],
  },
  governance: {
    title: "Certification status stays current",
    points: [
      "Expired certifications block reassignment automatically",
      "Completion records are timestamped and retained",
      "Training requirements are tied to the workflow, not managed separately",
    ],
  },
  related: [
    {
      label: "Workflow execution",
      href: "/product/workflow-execution",
      description:
        "Where a training-gated task appears in someone's task list.",
    },
    {
      label: "Audit center",
      href: "/product/audit-center",
      description: "Certification history available alongside other evidence.",
    },
    {
      label: "Human Resources solution",
      href: "/solutions/human-resources",
      description: "How training fits into onboarding and role changes.",
    },
  ],
  cta: {
    title: "Attach training to the work that actually needs it",
    description:
      "Stop tracking certifications in a spreadsheet separate from the task they apply to.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
