import { test, expect } from "@playwright/test";

test.describe("Desktop navigation", () => {
  test("opens a nav dropdown and follows a link", async ({ page }) => {
    await page.goto("/");

    const primaryNav = page.getByRole("navigation", { name: /primary/i });
    await primaryNav.getByRole("button", { name: /product/i }).click();
    const knowledgeLink = primaryNav.getByRole("link", { name: /knowledge/i });
    await expect(knowledgeLink).toBeVisible();
    await knowledgeLink.click();

    await expect(page).toHaveURL(/\/product\/knowledge$/);
    await expect(page.locator("h1")).toContainText(/policies and procedures/i);
  });

  test("primary CTAs navigate to the right routes", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Request a demo" }).first().click();
    await expect(page).toHaveURL(/\/request-demo$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Request demo" }).click();
    await expect(page).toHaveURL(/\/request-demo$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Start free trial" }).first().click();
    await expect(page).toHaveURL(/\/start-trial$/);
  });
});

test.describe("Mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens the mobile menu and navigates via a sub-link", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /open menu/i }).click();
    const mobileNav = page.locator("#mobile-nav");

    await mobileNav.getByRole("button", { name: /toggle product submenu/i }).click();
    await expect(mobileNav.getByRole("link", { name: "Knowledge" })).toBeVisible();

    await mobileNav.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app\/sign-in$/);
  });
});
