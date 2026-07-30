export interface PricingPlan {
  name: string;
  /** Prominent monthly price, e.g. "$99/month" or "Custom pricing" for negotiated plans. */
  price: string;
  /** Short line under the price: user limit for Team/Business, indicative starting price for Enterprise. */
  priceDetail: string;
  /** Annual price shown directly below the monthly price. Omitted for Enterprise (custom terms). */
  annualPrice?: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
  badge?: string;
}

export const pricingPlans: PricingPlan[] = [
  {
    name: "Team",
    price: "$99/month",
    priceDetail: "Up to 10 users",
    annualPrice: "$990/year — save two months",
    description:
      "For small teams ready to move their procedures out of static documents and into guided, accountable workflows.",
    features: [
      "Up to 10 users",
      "Up to 10 published workflows",
      "Core knowledge management",
      "Visual process builder",
      "Workflow execution and approvals",
      "Standard training assignments",
      "Email support",
    ],
    cta: { label: "Start free trial", href: "/start-trial" },
  },
  {
    name: "Business",
    price: "$249/month",
    priceDetail: "Up to 30 users",
    annualPrice: "$2,490/year — save two months",
    description:
      "For growing companies managing processes across multiple departments, teams, or locations.",
    features: [
      "Everything in Team",
      "Up to 30 users",
      "Unlimited published workflows",
      "Exceptions and CAPA management",
      "Analytics and audit center",
      "Department- and location-level rules",
      "Advanced training and reporting",
      "Priority support",
    ],
    cta: { label: "Request a demo", href: "/request-demo" },
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "Custom pricing",
    priceDetail: "Starting at $750/month",
    description:
      "For enterprise and regulated organizations requiring advanced security, implementation support, and customized operating terms.",
    features: [
      "Everything in Business",
      "SSO and advanced access controls",
      "Custom roles and permission models",
      "Dedicated implementation support",
      "Custom data-retention terms",
      "Custom integrations",
      "Enterprise security review",
      "Negotiated usage and support terms",
    ],
    cta: { label: "Contact sales", href: "/request-demo" },
  },
];

export const pricingNote =
  "All plans include secure cloud hosting, product updates, and standard onboarding resources. Taxes may apply.";

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
