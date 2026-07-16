import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProcessPilot",
    short_name: "ProcessPilot",
    description: "A calm operating system for repeatable business work.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#111318",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
