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

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const navRoutes = primaryNav.flatMap((group) => [
    group.href,
    ...group.items.map((item) => item.href),
  ]);
  const routes = Array.from(new Set([...staticRoutes, ...navRoutes]));

  return routes.map((route) => ({
    url: new URL(route, siteUrl).toString(),
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
