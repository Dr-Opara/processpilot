import { test, expect } from "@playwright/test";

test("shows a 404 page for an unknown route with a way back home", async ({
  page,
}) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);

  await expect(page.getByText("404")).toBeVisible();
  const homeLink = page.getByRole("link", { name: /back to home/i });
  await expect(homeLink).toBeVisible();

  await homeLink.click();
  await expect(page).toHaveURL(/\/$/);
});
