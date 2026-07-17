export interface NavLink {
  label: string;
  href: string;
  description?: string;
}

export interface NavGroup {
  label: string;
  href: string;
  items: NavLink[];
}

export const primaryNav: NavGroup[] = [
  {
    label: "Product",
    href: "/product",
    items: [
      {
        label: "Knowledge",
        href: "/product/knowledge",
        description: "Turn policies and SOPs into a governed source of truth.",
      },
      {
        label: "Process builder",
        href: "/product/process-builder",
        description: "Draft workflows from source documents, then refine them.",
      },
      {
        label: "Workflow execution",
        href: "/product/workflow-execution",
        description: "Guide employees through tasks, approvals, and handoffs.",
      },
      {
        label: "Training",
        href: "/product/training",
        description: "Assign role-based training tied to real workflows.",
      },
      {
        label: "Exceptions",
        href: "/product/exceptions",
        description: "Route and resolve work that falls outside the standard path.",
      },
      {
        label: "Analytics",
        href: "/product/analytics",
        description: "See where work slows down and where it breaks.",
      },
      {
        label: "Audit center",
        href: "/product/audit-center",
        description: "Keep evidence, approvals, and history in one place.",
      },
    ],
  },
  {
    label: "Solutions",
    href: "/solutions",
    items: [
      {
        label: "Operations",
        href: "/solutions/operations",
        description: "Standardize execution and reduce exception volume.",
      },
      {
        label: "Human Resources",
        href: "/solutions/human-resources",
        description: "Onboarding, policy acknowledgment, and training in one flow.",
      },
      {
        label: "Compliance",
        href: "/solutions/compliance",
        description: "Controlled documents, evidence, and audit history.",
      },
      {
        label: "Customer Operations",
        href: "/solutions/customer-operations",
        description: "Repeatable service processes with escalation paths.",
      },
      {
        label: "Multi-location",
        href: "/solutions/multi-location",
        description: "One operating model with room for local exceptions.",
      },
    ],
  },
  {
    label: "Industries",
    href: "/industries",
    items: [
      {
        label: "Property management",
        href: "/industries/property-management",
        description: "Move-ins, maintenance, and inspections across sites.",
      },
      {
        label: "Healthcare operations",
        href: "/industries/healthcare-operations",
        description: "Non-clinical operating procedures across locations.",
      },
      {
        label: "Professional services",
        href: "/industries/professional-services",
        description: "Client delivery playbooks that hold up under growth.",
      },
      {
        label: "Logistics",
        href: "/industries/logistics",
        description: "Dispatch, receiving, and safety procedures at scale.",
      },
      {
        label: "Franchises",
        href: "/industries/franchises",
        description: "One brand standard, applied consistently by every location.",
      },
    ],
  },
];

export const resourcesNav: NavLink = { label: "Resources", href: "/resources" };
export const pricingNav: NavLink = { label: "Pricing", href: "/pricing" };

export const footerColumns: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: primaryNav[0].items.map(({ label, href }) => ({ label, href })),
  },
  {
    title: "Solutions",
    links: primaryNav[1].items.map(({ label, href }) => ({ label, href })),
  },
  {
    title: "Industries",
    links: primaryNav[2].items.map(({ label, href }) => ({ label, href })),
  },
  {
    title: "Company",
    links: [
      { label: "Company", href: "/company" },
      { label: "Security", href: "/security" },
      { label: "Resources", href: "/resources" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Request a demo", href: "/request-demo" },
      { label: "Start free trial", href: "/start-trial" },
      { label: "Sign in", href: "/app/sign-in" },
    ],
  },
];

export const legalLinks: NavLink[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

/**
 * Fictional demonstration company used consistently across product marketing
 * surfaces. Not a real customer or customer outcome.
 */
export const demoCompany = {
  name: "Northstar Property Group",
  isDemonstrationData: true,
  locations: ["Houston", "Dallas", "Austin"],
  departments: ["People Operations", "IT", "Finance", "Operations", "Compliance"],
  exampleProcess: {
    name: "New employee onboarding",
    taskCount: 14,
    responsibleRoles: 4,
    approvals: 3,
    conditionalBranches: 2,
    evidenceRequirements: 8,
    trainingAssignments: 1,
  },
};

export const operatingLoop = [
  {
    title: "Import knowledge",
    description:
      "Bring in policies, SOPs, and institutional knowledge from documents your team already has.",
  },
  {
    title: "Generate a process",
    description:
      "Turn imported source material into a draft workflow with tasks, roles, and decision points.",
  },
  {
    title: "Review and publish",
    description:
      "A process owner reviews the draft, adjusts steps, and publishes a controlled version.",
  },
  {
    title: "Guide execution",
    description:
      "Employees follow the published workflow one step at a time, in the order it was designed.",
  },
  {
    title: "Capture evidence",
    description:
      "Approvals, uploads, and confirmations are recorded automatically as work happens.",
  },
  {
    title: "Improve the process",
    description:
      "Analytics show where work stalls or deviates, so the next version fixes a real problem.",
  },
];

export const productPillars = [
  {
    title: "Govern knowledge",
    description:
      "Keep policies and procedures in one controlled, versioned source instead of scattered documents.",
    href: "/product/knowledge",
  },
  {
    title: "Design workflows",
    description:
      "Turn source material into workflows with tasks, roles, approvals, and conditional branches.",
    href: "/product/process-builder",
  },
  {
    title: "Guide employees",
    description:
      "Walk people through the right steps in order, with training attached where it matters.",
    href: "/product/workflow-execution",
  },
  {
    title: "Improve operations",
    description: "See where work slows down or breaks, backed by evidence instead of anecdotes.",
    href: "/product/analytics",
  },
];

export const rolePreviews = [
  {
    role: "Employee",
    summary: "Follows a guided workflow one task at a time, with training and context attached.",
  },
  {
    role: "Manager",
    summary: "Sees team workload, approves exceptions, and reassigns work when someone is out.",
  },
  {
    role: "Process owner",
    summary: "Publishes new workflow versions and reviews where the current version breaks down.",
  },
  {
    role: "Compliance",
    summary: "Pulls evidence and approval history for a process without asking around for it.",
  },
  {
    role: "Executive",
    summary: "Sees completion rates and exception volume across locations in one view.",
  },
] as const;
