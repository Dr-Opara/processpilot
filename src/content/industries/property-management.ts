import type { IndustryPageContent } from "@/content/types";

export const propertyManagementContent: IndustryPageContent = {
  seo: {
    title: "Property management — standardized operations across sites",
    description:
      "Run move-ins, maintenance requests, and inspections consistently across every property with ProcessPilot.",
    path: "/industries/property-management",
  },
  eyebrow: "Property management",
  headline: "The same standard, whether it's one property or fifty",
  intro:
    "Property management operations span move-ins, maintenance, inspections, and renewals — often across teams that never see how another site handles the same task.",
  accent: "cobalt",
  disclaimer:
    "ProcessPilot is operational workflow software. It does not provide legal, fair-housing, or regulatory compliance advice, and using it does not guarantee compliance with any law or regulation.",
  challenges: [
    {
      title: "Move-in steps vary by site manager",
      description:
        "Without a shared workflow, each property team runs move-ins slightly differently, and inconsistencies show up in resident complaints.",
    },
    {
      title: "Maintenance requests lack a shared record",
      description:
        "Vendor assignment, follow-up, and completion confirmation happen over phone calls and text messages.",
    },
    {
      title: "Inspection follow-through is hard to track",
      description:
        "Findings from a unit inspection don't always turn into tracked, assigned follow-up work.",
    },
  ],
  workflows: [
    {
      title: "Move-in and move-out",
      description: "A consistent checklist from lease signing through key handoff and inspection.",
    },
    {
      title: "Maintenance requests",
      description: "Intake, vendor assignment, escalation, and completion in one tracked workflow.",
    },
    {
      title: "Unit inspections",
      description:
        "Findings turn directly into assigned follow-up tasks instead of a static report.",
    },
  ],
  whoUses: [
    {
      role: "Property manager",
      description: "Runs day-to-day operations for one or more properties.",
    },
    {
      role: "Maintenance technician",
      description: "Receives and completes assigned work orders.",
    },
    {
      role: "Regional operations lead",
      description: "Compares performance and standardizes process across properties.",
    },
  ],
  lifecycle: [
    {
      title: "Import",
      description: "Existing move-in and maintenance procedures are imported.",
    },
    {
      title: "Publish",
      description: "A regional lead reviews and publishes the standard workflow.",
    },
    {
      title: "Run",
      description: "Property teams execute the workflow for each unit or request.",
    },
    {
      title: "Review",
      description: "Completion data is reviewed to refine the next published version.",
    },
  ],
  templates: [
    {
      name: "Move-in / move-out checklist",
      description: "A 12-step workflow covering lease signing through key handoff.",
    },
    {
      name: "Maintenance request routing",
      description: "Intake, vendor assignment, and escalation for unresponsive vendors.",
    },
  ],
  related: [
    {
      label: "Operations solution",
      href: "/solutions/operations",
      description: "The broader case for standardized execution.",
    },
    {
      label: "Multi-location solution",
      href: "/solutions/multi-location",
      description: "Applying one operating model across every property.",
    },
    {
      label: "Customer operations solution",
      href: "/solutions/customer-operations",
      description: "How resident and tenant requests are handled.",
    },
  ],
  cta: {
    title: "Standardize your move-in process first",
    description:
      "See how a move-in workflow runs the same way whether it's your first property or your fiftieth.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
