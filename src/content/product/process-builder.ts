import type { ProductPageContent } from "@/content/types";

export const processBuilderContent: ProductPageContent = {
  seo: {
    title: "Process builder — turn documents into structured workflows",
    description:
      "Draft workflows with tasks, roles, approvals, and conditional branches from a source document, then refine before publishing.",
    path: "/product/process-builder",
  },
  eyebrow: "Design workflows",
  headline: "Turn a written procedure into a workflow someone can run",
  intro:
    "A policy document describes what should happen. Process builder turns that description into tasks, roles, approvals, and branches that people can actually follow.",
  accent: "signal",
  layout: "capability-first",
  problem: {
    title: "Writing a workflow from scratch takes too long",
    description:
      "Turning a five-page SOP into a usable, step-by-step workflow is manual work most process owners don't have time for.",
    points: [
      "Source documents describe intent, not discrete tasks",
      "Approval points and ownership are often implicit, not written down",
      "Conditional cases ('if the tenant is commercial...') get lost in prose",
      "Rebuilding a workflow after a policy change starts from zero",
    ],
  },
  capability: {
    title: "Draft, then refine",
    description:
      "Process builder proposes a task-by-task draft from a source document. A process owner edits roles, approvals, and branches before publishing.",
    bullets: [
      "Draft tasks proposed from an imported document",
      "Assign a responsible role to each task",
      "Add approvals at any step",
      "Add conditional branches for exceptions to the standard path",
    ],
  },
  workflowExample: {
    title: "Building a vendor approval workflow",
    steps: [
      {
        title: "Import the vendor policy",
        description: "Finance imports the existing vendor approval policy document.",
      },
      {
        title: "Review the proposed tasks",
        description:
          "A 6-task draft is proposed: request, budget check, two approvals, PO creation, vendor notification.",
      },
      {
        title: "Add a conditional branch",
        description:
          "A branch is added: requests over $10,000 require a second approval from Finance leadership.",
      },
      {
        title: "Publish the workflow",
        description: "The workflow goes live for the Operations and Finance teams.",
      },
    ],
  },
  roles: [
    {
      role: "Process owner",
      description: "Builds and publishes the workflow from a source document.",
    },
    {
      role: "Manager",
      description: "Reviews proposed approval points before a workflow goes live.",
    },
    {
      role: "Compliance",
      description: "Confirms required approvals and evidence steps are present.",
    },
  ],
  uiDemo: {
    title: "Process builder canvas",
    tags: ["Tasks", "Roles", "Approvals", "Branches"],
  },
  governance: {
    title: "Every workflow has a clear owner",
    points: [
      "Draft workflows are not visible to employees until published",
      "Publishing requires an assigned process owner",
      "Prior published versions remain in history",
    ],
  },
  related: [
    {
      label: "Knowledge",
      href: "/product/knowledge",
      description: "Where the source documents a workflow is built from are governed.",
    },
    {
      label: "Workflow execution",
      href: "/product/workflow-execution",
      description: "How employees experience a published workflow.",
    },
    {
      label: "Exceptions",
      href: "/product/exceptions",
      description: "What happens when work falls outside a conditional branch.",
    },
  ],
  cta: {
    title: "Turn your next policy update into a workflow",
    description: "Import a document and see a draft workflow in minutes, ready for your review.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
