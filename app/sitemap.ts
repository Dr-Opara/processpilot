import type { MetadataRoute } from "next";
import { pages } from "./site";
export default function sitemap(): MetadataRoute.Sitemap {
  const standardPages = pages
    .filter((x) => x !== "client-engagements")
    .map((x) => ({
      url: `https://processpilottech.com${x === "home" ? "" : `/${x}`}`,
      changeFrequency: "monthly" as const,
      priority: x === "home" ? 1 : 0.7,
    }));
  return [
    ...standardPages,
    {
      url: "https://processpilottech.com/engagements/dod-disa-subcontractor",
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
