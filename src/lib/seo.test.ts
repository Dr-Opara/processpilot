import { describe, expect, it } from "vitest";
import { buildMetadata, getSiteUrl } from "./seo";

describe("buildMetadata", () => {
  it("builds a canonical URL and OpenGraph data from a path", () => {
    const metadata = buildMetadata({
      title: "Knowledge",
      description: "Govern knowledge in one place.",
      path: "/product/knowledge",
    });

    const siteUrl = getSiteUrl();
    // The main `title` field is left unsuffixed: the root layout's
    // title.template appends " | ProcessPilot" for every nested segment.
    expect(metadata.title).toBe("Knowledge");
    expect(metadata.alternates?.canonical).toBe(
      new URL("/product/knowledge", siteUrl).toString(),
    );
    expect(metadata.openGraph?.title).toBe("Knowledge | ProcessPilot");
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("does not suffix the OpenGraph title on the homepage, since the layout template is skipped there", () => {
    const metadata = buildMetadata({
      title: "The operating system for repeatable work",
      description: "Home",
      path: "/",
    });

    expect(metadata.title).toBe("The operating system for repeatable work");
    expect(metadata.openGraph?.title).toBe(
      "The operating system for repeatable work",
    );
  });

  it("marks noIndex pages as non-indexable", () => {
    const metadata = buildMetadata({
      title: "Sign in",
      description: "Sign in",
      path: "/sign-in",
      noIndex: true,
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
