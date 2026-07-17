export const glossary: { term: string; definition: string }[] = [
  {
    term: "Workflow",
    definition:
      "A published, structured version of a process: an ordered set of tasks, roles, approvals, and conditional branches.",
  },
  {
    term: "Process owner",
    definition:
      "The person responsible for reviewing, publishing, and maintaining a specific workflow.",
  },
  {
    term: "Evidence",
    definition:
      "An upload, confirmation, or sign-off captured as part of completing a task, retained as a record.",
  },
  {
    term: "Exception",
    definition:
      "Work that doesn't fit the standard path of a published workflow and is routed to a defined owner for resolution.",
  },
  {
    term: "Conditional branch",
    definition:
      "A point in a workflow where the next step depends on a condition, such as location or request type.",
  },
  {
    term: "Published version",
    definition:
      "The current, live version of a workflow that employees are guided through. Prior versions remain in history.",
  },
];

export const resourceCategories: {
  title: string;
  description: string;
  status: "Available" | "In progress";
}[] = [
  {
    title: "Terminology glossary",
    description: "Definitions for the core concepts used across the platform.",
    status: "Available",
  },
  {
    title: "Implementation guides",
    description: "Step-by-step guides for publishing your first workflow.",
    status: "In progress",
  },
  {
    title: "Workflow template library",
    description: "Example templates referenced across product and industry pages.",
    status: "In progress",
  },
];
