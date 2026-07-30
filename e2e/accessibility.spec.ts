import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Phase 29: design/accessibility.md has required "automated checks (e.g.
 * axe-core integrated into Playwright)... starting Phase 1" since this
 * document was first written — no such check existed anywhere in the
 * codebase until this phase added one. Scoped to the public marketing
 * site for now (no real Clerk credentials are guaranteed in every
 * environment this runs in, so the authenticated /app/* shell isn't
 * covered here — see docs/architecture/final-audit-2026-07.md's known
 * gaps).
 *
 * Scanned against the WCAG 2.1 AA ruleset, matching
 * design/accessibility.md's stated baseline. Best-practice rules are
 * deliberately excluded — those are useful hygiene rules, not the AA
 * conformance bar the design system commits to.
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
  "/legal/acceptable-use",
  "/legal/subprocessors",
  "/legal/dpa",
  "/legal/professional-services-terms",
  "/legal/statement-of-work-template",
  "/legal/independent-contractor-template",
];

for (const route of publicRoutes) {
  test(`${route} has no WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(route);
    // Every public page renders ClerkProvider, whose dev-mode keyless-sync
    // background redirect can still be in flight right after `load` —
    // the same race e2e/legal-pages.spec.ts's header comment documents.
    // Waiting for network idle here (axe's page.evaluate() otherwise
    // intermittently hits a destroyed execution context mid-navigation)
    // is cheaper than restructuring this into per-navigation retries.
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(
      results.violations,
      results.violations
        .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`)
        .join("\n"),
    ).toEqual([]);
  });
}
