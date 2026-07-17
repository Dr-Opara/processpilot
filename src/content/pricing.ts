export interface PricingPlan {
  name: string;
  audience: string;
  priceHypothesis: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
}

export const pricingPlans: PricingPlan[] = [
  {
    name: "Team",
    audience: "Single-location teams up to roughly 50 people",
    priceHypothesis: "Starting-price hypothesis — contact sales to confirm",
    description:
      "For a single team that wants its core procedures out of static documents and into a guided workflow.",
    features: [
      "Up to 10 published workflows",
      "Core knowledge, process builder, and execution",
      "Standard training assignments",
      "Email support",
    ],
    cta: { label: "Start free trial", href: "/start-trial" },
  },
  {
    name: "Business",
    audience: "Multi-location or multi-department companies",
    priceHypothesis: "Starting-price hypothesis — contact sales to confirm",
    description:
      "For companies running the same process across multiple locations or departments, with exceptions to manage.",
    features: [
      "Unlimited published workflows",
      "Exceptions, analytics, and audit center",
      "Location- and department-level rules",
      "Priority support",
    ],
    cta: { label: "Request a demo", href: "/request-demo" },
    highlighted: true,
  },
  {
    name: "Enterprise",
    audience: "Enterprise and regulated organizations",
    priceHypothesis: "Contact sales",
    description:
      "For organizations that need enterprise security controls, dedicated implementation support, and custom usage terms.",
    features: [
      "Everything in Business",
      "SSO roadmap access and advanced access controls",
      "Dedicated implementation support",
      "Custom data retention and usage terms",
    ],
    cta: { label: "Contact sales", href: "/request-demo" },
  },
];

export const pricingConsiderations = [
  {
    title: "Implementation support",
    description:
      "Team and Business plans include self-serve setup guides. Enterprise plans include a dedicated implementation contact for the first published workflows.",
  },
  {
    title: "AI and usage considerations",
    description:
      "AI-assisted drafting is included on all plans. Usage limits scale with plan tier and are confirmed during setup, not enforced silently.",
  },
  {
    title: "Enterprise security options",
    description:
      "Enterprise plans can add advanced access controls and custom data retention terms. See the security page for what's available today versus planned.",
  },
];
