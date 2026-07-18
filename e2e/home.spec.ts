import { test, expect } from "@playwright/test";

test("home page renders the ProcessPilot heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByRole("heading", { name: "ProcessPilot", exact: true }),
  ).toBeVisible();
});
