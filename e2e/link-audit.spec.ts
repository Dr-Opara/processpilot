import { test, expect } from "@playwright/test";

/**
 * Phase 29: a site-wide broken-internal-link sweep. routes.spec.ts
 * already proves every public route itself returns 200; this spec goes
 * one level further and checks every internal link *rendered on* each
 * of those pages also resolves, the same pattern
 * e2e/legal-pages.spec.ts already established for the legal/trust pages
 * specifically — generalized here to the whole public site.
 */
const publicRoutes = [
  "/",
  "/product",
  "/product/knowledge",
  "/product/process-builder",
  "/product/workflow-execution",
  "/product/training",
  "/product/exceptions",
  "/product/analytics",
  "/product/audit-center",
  "/solutions",
  "/solutions/operations",
  "/solutions/human-resources",
  "/solutions/compliance",
  "/solutions/customer-operations",
  "/solutions/multi-location",
  "/industries",
  "/industries/property-management",
  "/industries/healthcare-operations",
  "/industries/professional-services",
  "/industries/logistics",
  "/industries/franchises",
  "/pricing",
  "/security",
  "/trust",
  "/resources",
  "/company",
  "/request-demo",
  "/start-trial",
  "/privacy",
  "/terms",
];

for (const route of publicRoutes) {
  test(`${route}'s internal links are not broken`, async ({ page }) => {
    await page.goto(route);

    const internalLinks = await page
      .locator("a[href^='/']")
      .evaluateAll((anchors) =>
        anchors.map((a) => a.getAttribute("href")).filter((href): href is string => Boolean(href)),
      );

    for (const href of new Set(internalLinks)) {
      // Strip a hash/query fragment before checking — the route itself is
      // what needs to resolve, not any anchor within it.
      const path = href.split("#")[0].split("?")[0];
      if (!path) continue;
      const linkResponse = await page.request.get(path);
      expect(linkResponse.ok(), `Broken internal link on ${route}: ${href}`).toBe(true);
    }
  });
}
