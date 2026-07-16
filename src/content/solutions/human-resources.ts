import type { SolutionPageContent } from "@/content/types";

export const humanResourcesSolutionContent: SolutionPageContent = {
  seo: {
    title: "Human Resources — onboarding, policy, and training in one flow",
    description:
      "Run employee onboarding, policy acknowledgment, and role-based training as one guided workflow instead of separate systems.",
    path: "/solutions/human-resources",
  },
  eyebrow: "Solutions for Human Resources",
  headline: "Onboarding that doesn't depend on a checklist in someone's inbox",
  intro:
    "HR teams juggle onboarding, policy acknowledgment, and training across systems that don't talk to each other. ProcessPilot runs them as one workflow.",
  accent: "success",
  audience: "HR and People Operations leaders",
  challenges: [
    {
      title: "Onboarding is a manual checklist",
      description:
        "A new hire's first weeks depend on someone remembering every step across IT, payroll, and training.",
    },
    {
      title: "Policy acknowledgment is hard to prove",
      description:
        "Confirming who has read and acknowledged the current policy version means digging through email receipts.",
    },
    {
      title: "Training and role changes are disconnected",
      description:
        "When someone changes roles, no system automatically assigns the training their new role requires.",
    },
  ],
  capabilities: [
    {
      title: "Employee onboarding",
      description:
        "One workflow spanning IT, payroll, facilities, and manager tasks, with a clear owner for each step.",
    },
    {
      title: "Policy acknowledgment",
      description:
        "Acknowledgments are tied to the current published policy version, with a timestamped record.",
    },
    {
      title: "Role-based training",
      description:
        "Training assigned automatically based on role, tracked alongside the workflow it supports.",
    },
    {
      title: "Certification tracking",
      description:
        "Expiring certifications are visible before they lapse, not discovered after.",
    },
  ],
  workflowExample: {
    title: "Running new-employee onboarding",
    steps: [
      {
        title: "Offer accepted",
        description:
          "The 14-task onboarding workflow is assigned across 4 responsible roles.",
      },
      {
        title: "Policy acknowledgment",
        description:
          "The new hire acknowledges the remote-work and safety policies.",
      },
      {
        title: "Manager approval",
        description: "A manager confirms completion of the 30-day check-in.",
      },
      {
        title: "Workflow closes",
        description:
          "All 14 tasks and 8 evidence requirements are complete and recorded.",
      },
    ],
  },
  outcomes: [
    "One onboarding workflow instead of a checklist per manager",
    "Policy acknowledgment is provable, not assumed",
    "Training assignment follows role changes automatically",
    "HR sees onboarding progress without emailing every manager",
  ],
  related: [
    {
      label: "Training",
      href: "/product/training",
      description: "How role-based training is assigned and tracked.",
    },
    {
      label: "Knowledge",
      href: "/product/knowledge",
      description: "Where policies live before they're attached to a workflow.",
    },
    {
      label: "Compliance",
      href: "/solutions/compliance",
      description: "How HR evidence supports broader compliance reporting.",
    },
  ],
  cta: {
    title: "Replace the onboarding checklist with a workflow",
    description:
      "See how a new hire, a manager, and IT experience the same onboarding process.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
