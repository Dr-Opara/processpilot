import { test, expect } from "@playwright/test";

test("home page renders the ProcessPilot logo and hero heading", async ({ page }) => {
  await page.goto("/");

  const logoLink = page.getByRole("banner").getByRole("link", { name: "ProcessPilot" });
  await expect(logoLink).toBeVisible();
  await expect(logoLink).toHaveAttribute("href", "/");
  await expect(logoLink.getByRole("img", { name: "ProcessPilot" })).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name: "Turn company procedures into work people can actually complete.",
      level: 1,
    }),
  ).toBeVisible();
});
