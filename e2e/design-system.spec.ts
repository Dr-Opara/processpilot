import { test, expect } from "@playwright/test";

test("design system route is available when enabled", async ({ page }) => {
  await page.goto("/design-system");
  await expect(page.getByText(/processpilot design system/i)).toBeVisible();
});
