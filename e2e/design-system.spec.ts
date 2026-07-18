import { test, expect } from "@playwright/test";

/**
 * NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM is baked into the deployed target at
 * build time (see docs/development/environment-variables.md), which the
 * test process can't read directly when running against a remote preview
 * URL. Detect it from the route's actual behavior instead: disabled
 * renders a 404 (see src/app/design-system/page.tsx), so skip in that
 * case rather than asserting on content that was never meant to exist.
 */
test("design system route is available when enabled", async ({ page }) => {
  const response = await page.goto("/design-system");
  test.skip(
    response?.status() === 404,
    "NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM is disabled for this target",
  );

  await expect(page.getByText(/processpilot design system/i)).toBeVisible();
});
