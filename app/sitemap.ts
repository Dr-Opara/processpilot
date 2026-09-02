import type { MetadataRoute } from "next";
import { pages } from "./site";
export default function sitemap(): MetadataRoute.Sitemap {
  return pages
    .filter((x) => x !== "client-engagements")
    .map((x) => ({
      url: `https://processpilottech.com${x === "home" ? "" : `/${x}`}`,
      changeFrequency: "monthly",
      priority: x === "home" ? 1 : 0.7,
    }));
}
