import { test, expect } from "@playwright/test";

const pages = [
  { path: "/", title: /The operating system for repeatable work/ },
  { path: "/product/knowledge", title: /Knowledge.*\| ProcessPilot$/ },
  { path: "/solutions/compliance", title: /Compliance.*\| ProcessPilot$/ },
  { path: "/pricing", title: /Pricing \| ProcessPilot$/ },
];

for (const { path, title } of pages) {
  test(`generates unique title and description metadata for ${path}`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute("content", /.+/);

    const canonical = page.locator('link[rel="canonical"]');
    const expectedPattern =
      path === "/" ? /processpilot\.com\/?$/ : new RegExp(`${path}$`);
    await expect(canonical).toHaveAttribute("href", expectedPattern);
  });
}

test("sitemap and robots.txt are served", async ({ page }) => {
  const sitemap = await page.goto("/sitemap.xml");
  expect(sitemap?.ok()).toBe(true);

  const robots = await page.goto("/robots.txt");
  expect(robots?.ok()).toBe(true);
  const body = await robots?.text();
  expect(body).toContain("Sitemap:");
});
