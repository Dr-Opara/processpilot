import type { ProductPageContent } from "@/content/types";

export const workflowExecutionContent: ProductPageContent = {
  seo: {
    title: "Workflow execution — guide employees through published work",
    description:
      "Walk employees through tasks, approvals, and handoffs in the order a workflow was designed to run.",
    path: "/product/workflow-execution",
  },
  eyebrow: "Guide employees",
  headline: "Give employees one clear next step, not a document to interpret",
  intro:
    "A published workflow only works if people can follow it without guessing. Workflow execution shows each person their next task, in order, with the context they need.",
  accent: "success",
  layout: "workflow-first",
  problem: {
    title: "Following a written procedure is easy to get wrong",
    description:
      "Even a well-written SOP leaves room for people to skip steps, do them out of order, or forget to hand off to the next person.",
    points: [
      "No single place to see 'what do I do next'",
      "Handoffs between roles depend on someone remembering to notify the next person",
      "Managers can't see who's behind without asking",
      "Partially completed work is easy to lose track of",
    ],
  },
  capability: {
    title: "One task list, in order",
    description:
      "Each person sees the tasks assigned to their role, in the sequence the workflow defines, with automatic handoff to the next person.",
    bullets: [
      "Task lists scoped to a person's role",
      "Automatic handoff when a task is completed",
      "Manager view of team-wide progress",
      "Blocked tasks are visible, not hidden in someone's inbox",
    ],
  },
  workflowExample: {
    title: "Running new-employee onboarding",
    steps: [
      {
        title: "IT provisions equipment",
        description: "IT completes the equipment task assigned for day one.",
      },
      {
        title: "New hire acknowledges policies",
        description: "The employee completes required policy acknowledgments.",
      },
      {
        title: "Manager confirms 30-day check-in",
        description: "A manager approval task appears automatically at day 30.",
      },
      {
        title: "Workflow marked complete",
        description:
          "The full 14-task onboarding workflow closes once all steps finish.",
      },
    ],
  },
  roles: [
    {
      role: "Employee",
      description:
        "Sees their next task and completes it without hunting for instructions.",
    },
    {
      role: "Manager",
      description: "Sees team-wide progress and where handoffs are stuck.",
    },
    {
      role: "Process owner",
      description:
        "Sees where the current version of a workflow is slow or unclear.",
    },
  ],
  uiDemo: {
    title: "Task list",
    tags: ["My tasks", "Handoffs", "Due dates", "Blocked"],
  },
  governance: {
    title: "Every task is tied back to the published workflow",
    points: [
      "Tasks can't be skipped without leaving a record",
      "Completed tasks are timestamped automatically",
      "Managers see exceptions without needing a status meeting",
    ],
  },
  related: [
    {
      label: "Process builder",
      href: "/product/process-builder",
      description: "How the workflow being executed was designed.",
    },
    {
      label: "Exceptions",
      href: "/product/exceptions",
      description: "What happens when a task doesn't fit the standard path.",
    },
    {
      label: "Training",
      href: "/product/training",
      description:
        "Attach training to a task before someone has to complete it.",
    },
  ],
  cta: {
    title: "See a workflow run end to end",
    description:
      "Watch a task move from assignment to handoff to completion in a live walkthrough.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
