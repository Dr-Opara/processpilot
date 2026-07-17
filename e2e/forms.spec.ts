import { test, expect } from "@playwright/test";

test.describe("Request demo form", () => {
  test("shows validation errors on empty submit, then succeeds in dev mode", async ({ page }) => {
    await page.goto("/request-demo");

    await page.getByRole("button", { name: /request a demo/i }).click();
    await expect(page.getByText(/first name is required/i)).toBeVisible();

    await page.getByLabel("First name").fill("Ada");
    await page.getByLabel("Last name").fill("Lovelace");
    await page.getByLabel("Work email").fill("ada@northstar.example");
    await page.getByLabel("Company").fill("Northstar Property Group");
    await page.getByLabel("Job title").fill("Operations Director");
    await page.getByLabel("Employee count").selectOption("51-200");
    await page
      .getByLabel("Primary use case")
      .selectOption("Standardizing operations across locations");

    await page.getByRole("button", { name: /request a demo/i }).click();

    await expect(page.getByText(/development mode: this request was validated/i)).toBeVisible();
  });
});

test.describe("Start trial form", () => {
  test("rejects a weak password and requires terms agreement", async ({ page }) => {
    await page.goto("/start-trial");

    await page.getByLabel("First name").fill("Ada");
    await page.getByLabel("Last name").fill("Lovelace");
    await page.getByLabel("Work email").fill("ada@northstar.example");
    await page.getByLabel("Company name").fill("Northstar Property Group");
    await page.getByLabel("Employee count").selectOption("51-200");
    await page.getByLabel("Industry").selectOption("Property management");

    // The terms checkbox has its own required rule, which short-circuits
    // form submission before our zod validation runs, so it must be
    // checked to isolate the password-strength assertion below.
    await page.getByLabel(/i agree to the/i).check();
    await page.getByLabel("Password").fill("weak");

    await page.getByRole("button", { name: /start free trial/i }).click();

    await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible();

    await page.getByLabel(/i agree to the/i).uncheck();
    await page.getByLabel("Password").fill("Str0ngPass");
    await page.getByRole("button", { name: /start free trial/i }).click();

    await expect(page.getByText(/you must agree to the terms/i)).toBeVisible();

    await page.getByLabel(/i agree to the/i).check();
    await page.getByRole("button", { name: /start free trial/i }).click();

    await expect(page.getByText(/development mode: this signup was validated/i)).toBeVisible();
  });
});
