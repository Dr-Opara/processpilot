import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";
import { primaryNav } from "@/content/site";

const staticRoutes = [
  "/",
  "/product",
  "/solutions",
  "/industries",
  "/pricing",
  "/security",
  "/resources",
  "/company",
  "/request-demo",
  "/start-trial",
  "/sign-in",
  "/privacy",
  "/terms",
  "/legal/acceptable-use",
  "/legal/subprocessors",
  "/legal/dpa",
  "/legal/professional-services-terms",
  "/legal/statement-of-work-template",
  "/legal/independent-contractor-template",
  "/trust",
];

// Phase 31: professional-services/client-engagement routes intentionally
// carry lower sitemap priority than product/solutions/industries routes
// — SEO signaling should reflect the same "products remain dominant"
// positioning requirement as the nav and homepage, not just visual
// hierarchy.
const secondaryRoutes = [
  "/services",
  "/services/ai",
  "/services/cybersecurity",
  "/services/compliance-governance",
  "/engagements",
  "/request-consultation",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const navRoutes = primaryNav.flatMap((group) => [
    group.href,
    ...group.items.map((item) => item.href),
  ]);
  const routes = Array.from(new Set([...staticRoutes, ...navRoutes, ...secondaryRoutes]));

  function priorityFor(route: string): number {
    if (route === "/") return 1;
    if (secondaryRoutes.includes(route)) return 0.4;
    return 0.7;
  }

  return routes.map((route) => ({
    url: new URL(route, siteUrl).toString(),
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: priorityFor(route),
  }));
}
