import { test, expect } from "@playwright/test";

const viewports = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};

for (const [name, viewport] of Object.entries(viewports)) {
  test(`homepage renders without horizontal overflow at ${name} width`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
}

test("navigation switches from full nav to a hamburger menu below the desktop breakpoint", async ({
  page,
}) => {
  await page.setViewportSize(viewports.desktop);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /product/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /open menu/i })).toBeHidden();

  await page.setViewportSize(viewports.mobile);
  await page.reload();
  await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();
});
