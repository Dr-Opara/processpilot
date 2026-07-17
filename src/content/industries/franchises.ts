import type { IndustryPageContent } from "@/content/types";

export const franchisesContent: IndustryPageContent = {
  seo: {
    title: "Franchises — one brand standard, applied consistently",
    description:
      "Give every franchise location the same operating procedures, with central oversight and comparative performance data.",
    path: "/industries/franchises",
  },
  eyebrow: "Franchises",
  headline: "One brand standard, run the same way at every location",
  intro:
    "Franchise brands succeed when every location delivers the same experience. ProcessPilot gives franchisors one published standard and franchisees a clear, guided workflow to follow.",
  accent: "signal",
  disclaimer:
    "ProcessPilot standardizes operating procedures. It does not review franchise agreements, royalty terms, or legal compliance obligations between franchisor and franchisee.",
  challenges: [
    {
      title: "Brand standards live in a manual nobody opens",
      description:
        "The franchise operations manual is a static PDF that new location owners skim once and rarely reference again.",
    },
    {
      title: "New location openings are inconsistent",
      description:
        "Each new location interprets the opening checklist differently, leading to uneven customer experience at launch.",
    },
    {
      title: "The franchisor can't see execution, only outcomes",
      description:
        "Headquarters sees sales and complaint data, but not whether the underlying procedure was actually followed.",
    },
  ],
  workflows: [
    {
      title: "New location opening",
      description: "A guided workflow from signed agreement to opening day, step by step.",
    },
    {
      title: "Brand standard operating procedures",
      description:
        "Day-to-day procedures published once and followed identically across locations.",
    },
    {
      title: "Franchisee training",
      description:
        "Role-based training tied to the specific procedures each location role performs.",
    },
  ],
  whoUses: [
    {
      role: "Franchisor operations team",
      description: "Publishes and updates the brand standard workflow.",
    },
    {
      role: "Franchise owner",
      description: "Runs their location against the published standard.",
    },
    {
      role: "Location staff",
      description: "Follows guided task lists for day-to-day procedures.",
    },
  ],
  lifecycle: [
    {
      title: "Import",
      description: "The existing operations manual is imported as a starting draft.",
    },
    {
      title: "Publish",
      description: "The franchisor's operations team reviews and publishes the standard.",
    },
    {
      title: "Run",
      description: "Every location executes the same published workflow.",
    },
    {
      title: "Review",
      description: "Adoption and performance data inform manual updates.",
    },
  ],
  templates: [
    {
      name: "New location opening checklist",
      description: "A step-by-step workflow from signed agreement to opening day.",
    },
    {
      name: "Daily operating procedure",
      description: "A recurring workflow covering opening and closing procedures.",
    },
  ],
  related: [
    {
      label: "Multi-location solution",
      href: "/solutions/multi-location",
      description: "The underlying model for running one standard across many sites.",
    },
    {
      label: "Training",
      href: "/product/training",
      description: "How franchisee and staff training ties to specific procedures.",
    },
    {
      label: "Analytics",
      href: "/product/analytics",
      description: "Comparing execution and performance across locations.",
    },
  ],
  cta: {
    title: "Turn your operations manual into a guided workflow",
    description: "See how a new location opening runs step by step, the same way every time.",
    primary: { label: "Request a demo", href: "/request-demo" },
    secondary: { label: "Start free trial", href: "/start-trial" },
  },
};
