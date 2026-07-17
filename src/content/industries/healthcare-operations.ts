import type { IndustryPageContent } from "@/content/types";

export const healthcareOperationsContent: IndustryPageContent = {
  seo: {
    title: "Healthcare operations — non-clinical workflow standardization",
    description:
      "Standardize non-clinical operating procedures — credentialing intake, facilities, and administrative workflows — across locations.",
    path: "/industries/healthcare-operations",
  },
  eyebrow: "Healthcare operations",
  headline: "Consistent non-clinical operations across every location",
  intro:
    "Administrative and facilities workflows in healthcare settings need to be reliable and well-documented, even though the clinical work itself sits outside ProcessPilot.",
  accent: "success",
  disclaimer:
    "ProcessPilot is operational workflow software for administrative and facilities processes. It is not a clinical, medical-records, or HIPAA-compliance product, and does not manage patient care or protected health information.",
  challenges: [
    {
      title: "Administrative steps vary by front-desk staff",
      description:
        "Patient intake logistics, credentialing paperwork, and facility procedures aren't always followed the same way by every team member.",
    },
    {
      title: "Facilities and vendor procedures live in binders",
      description:
        "Equipment maintenance schedules and vendor procedures are often paper-based or scattered across shared drives.",
    },
    {
      title: "Staff onboarding is inconsistent across locations",
      description:
        "New administrative staff at different locations complete different versions of the same onboarding steps.",
    },
  ],
  workflows: [
    {
      title: "Front-desk and intake logistics",
      description:
        "Standardize the administrative side of patient intake, separate from clinical documentation.",
    },
    {
      title: "Facilities and equipment maintenance",
      description: "Scheduled maintenance and vendor coordination tracked as recurring workflows.",
    },
    {
      title: "Administrative staff onboarding",
      description: "Consistent onboarding for front-office and operations staff across locations.",
    },
  ],
  whoUses: [
    {
      role: "Practice operations manager",
      description: "Owns administrative and facilities workflows for one or more locations.",
    },
    {
      role: "Front-office staff",
      description: "Follows standardized intake and administrative procedures.",
    },
    {
      role: "Facilities coordinator",
      description: "Manages equipment maintenance and vendor workflows.",
    },
  ],
  lifecycle: [
    {
      title: "Import",
      description: "Existing administrative procedures are imported as a starting draft.",
    },
    {
      title: "Publish",
      description: "An operations manager reviews and publishes the standard.",
    },
    {
      title: "Run",
      description: "Front-office and facilities staff execute the published workflow.",
    },
    {
      title: "Review",
      description: "Completion and exception data inform the next revision.",
    },
  ],
  templates: [
    {
      name: "Administrative staff onboarding",
      description: "A standard onboarding workflow for front-office and operations hires.",
    },
    {
      name: "Equipment maintenance schedule",
      description: "Recurring maintenance tasks with vendor coordination and completion tracking.",
    },
  ],
  related: [
    {
      label: "Operations solution",
      href: "/solutions/operations",
      description: "The broader case for standardized administrative execution.",
    },
    {
      label: "Human Resources solution",
      href: "/solutions/human-resources",
      description: "Onboarding and training for administrative staff.",
    },
    {
      label: "Multi-location solution",
      href: "/solutions/multi-location",
      description: "One operating model across multiple facilities.",
    },
  ],
  cta: {
    title: "Standardize the operations behind the front desk",
    description:
      "See how administrative and facilities workflows run consistently across your locations.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
