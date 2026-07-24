import { test, expect } from "@playwright/test";

test("home page renders the ProcessPilot logo and hero heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("img", { name: "ProcessPilot" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Turn company procedures into work people can actually complete.",
      level: 1,
    }),
  ).toBeVisible();
});
