export interface SeoContent {
  title: string;
  description: string;
  path: string;
}

export interface CtaLink {
  label: string;
  href: string;
  variant?: "primary" | "secondary" | "quiet";
}

export interface RelatedLink {
  label: string;
  href: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface WorkflowStep {
  title: string;
  description: string;
}

export interface RoleRef {
  role: string;
  description: string;
}

export interface ProductPageContent {
  seo: SeoContent;
  eyebrow: string;
  headline: string;
  intro: string;
  accent: "cobalt" | "success" | "warning";
  layout: "capability-first" | "workflow-first" | "governance-first";
  problem: {
    title: string;
    description: string;
    points: string[];
  };
  capability: {
    title: string;
    description: string;
    bullets: string[];
  };
  workflowExample: {
    title: string;
    steps: WorkflowStep[];
  };
  roles: RoleRef[];
  uiDemo: {
    title: string;
    tags: string[];
  };
  governance: {
    title: string;
    points: string[];
  };
  related: RelatedLink[];
  cta: {
    title: string;
    description: string;
    primary: CtaLink;
    secondary: CtaLink;
  };
}

export interface SolutionPageContent {
  seo: SeoContent;
  eyebrow: string;
  headline: string;
  intro: string;
  accent: "cobalt" | "success" | "warning";
  audience: string;
  challenges: {
    title: string;
    description: string;
  }[];
  capabilities: {
    title: string;
    description: string;
  }[];
  workflowExample: {
    title: string;
    steps: WorkflowStep[];
  };
  outcomes: string[];
  related: RelatedLink[];
  cta: {
    title: string;
    description: string;
    primary: CtaLink;
    secondary: CtaLink;
  };
}

/**
 * Phase 31: ProcessPilot Technologies' professional-services offerings
 * (AI, cybersecurity, compliance/governance engagements) — deliberately
 * a separate content shape from ProductPageContent/SolutionPageContent,
 * not a reuse of either. These are project engagements sold and
 * delivered independently of the SaaS product (see
 * src/content/legal.ts's ClientRelationshipType), so their CTAs
 * ("Discuss a Project" / "Request a Consultation") and framing
 * (`disclaimer`) are intentionally distinct from product CTAs
 * ("Start Free Trial") — the positioning requirement that Products stay
 * dominant depends on these pages never reading as another product
 * surface.
 */
export interface ServicePageContent {
  seo: SeoContent;
  eyebrow: string;
  headline: string;
  intro: string;
  accent: "cobalt" | "success" | "warning";
  disclaimer: string;
  offerings: {
    title: string;
    description: string;
  }[];
  engagementModel: {
    title: string;
    description: string;
  }[];
  related: RelatedLink[];
  cta: {
    title: string;
    description: string;
    primary: CtaLink;
    secondary: CtaLink;
  };
}

export interface IndustryPageContent {
  seo: SeoContent;
  eyebrow: string;
  headline: string;
  intro: string;
  accent: "cobalt" | "success" | "warning";
  disclaimer: string;
  challenges: {
    title: string;
    description: string;
  }[];
  workflows: {
    title: string;
    description: string;
  }[];
  whoUses: RoleRef[];
  lifecycle: WorkflowStep[];
  templates: {
    name: string;
    description: string;
  }[];
  related: RelatedLink[];
  cta: {
    title: string;
    description: string;
    primary: CtaLink;
    secondary: CtaLink;
  };
}
