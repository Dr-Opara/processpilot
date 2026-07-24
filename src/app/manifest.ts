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
    icons: [
      { src: "/brand/icons/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/brand/icons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icons/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/brand/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
