import { test, expect } from "@playwright/test";

test("role preview tabs switch panels", async ({ page }) => {
  await page.goto("/");

  const managerTab = page.getByRole("tab", { name: "Manager" });
  await managerTab.click();
  await expect(managerTab).toHaveAttribute("aria-selected", "true");

  const managerPanel = page.getByRole("tabpanel", { name: "Manager" });
  await expect(managerPanel).toBeVisible();
  await expect(managerPanel).toContainText(/approval queue/i);
});

test("FAQ accordion expands and collapses questions", async ({ page }) => {
  await page.goto("/");

  const question = page.getByRole("button", {
    name: /who writes the first draft/i,
  });
  await expect(question).toHaveAttribute("aria-expanded", "false");

  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
});
