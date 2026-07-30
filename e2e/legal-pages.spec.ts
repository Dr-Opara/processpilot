import { test, expect } from "@playwright/test";

/**
 * Phase 25 — legal/trust page accessibility, links, and content-quality
 * checks: no broken links, a visible heading, and no leftover
 * unsupported-claim language.
 */
const legalPages = [
  "/terms",
  "/privacy",
  "/legal/acceptable-use",
  "/legal/subprocessors",
  "/legal/dpa",
  "/legal/professional-services-terms",
  "/legal/statement-of-work-template",
  "/legal/independent-contractor-template",
  "/trust",
];

for (const path of legalPages) {
  test(`${path} renders a heading and loads successfully`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test(`${path}'s in-content links (excluding shared header/footer nav) are not broken`, async ({
    page,
  }) => {
    await page.goto(path);

    // Scoped to <main> so this doesn't re-fetch every shared header/footer
    // nav link on every legal page (slow against a dev server that
    // lazily compiles each route on first hit) — the site-wide nav
    // already has its own broken-link coverage in e2e/routes.spec.ts.
    const internalLinks = await page
      .locator("main a[href^='/']")
      .evaluateAll((anchors) =>
        anchors.map((a) => a.getAttribute("href")).filter((href): href is string => Boolean(href)),
      );
    for (const href of new Set(internalLinks)) {
      const linkResponse = await page.request.get(href);
      expect(linkResponse.ok(), `Broken internal link on ${path}: ${href}`).toBe(true);
    }
  });
}

// One test per page (not a single test looping page.goto() across all
// four) — sequential same-tab navigations here raced Clerk's dev-mode
// keyless-sync background redirect from the previous page, intermittently
// aborting the next goto() with net::ERR_ABORTED. Separate tests each get
// their own fresh page fixture, which sidesteps the race entirely.
for (const path of ["/terms", "/privacy", "/trust", "/security"]) {
  test(`${path} does not claim a certification we don't hold`, async ({ page }) => {
    await page.goto(path);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/SOC ?2 certified|ISO ?27001 certified|HIPAA compliant/i);
  });
}

test("the security page's controls do not overclaim malware scanning as done", async ({ page }) => {
  await page.goto("/security");
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.toLowerCase()).toContain("malware");
  expect(bodyText).toContain("Planned");
});
