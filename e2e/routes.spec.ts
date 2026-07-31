import { test, expect } from "@playwright/test";

const criticalRoutes = [
  "/",
  "/product",
  "/product/knowledge",
  "/product/process-builder",
  "/product/workflow-execution",
  "/product/training",
  "/product/exceptions",
  "/product/analytics",
  "/product/audit-center",
  "/solutions",
  "/solutions/operations",
  "/solutions/human-resources",
  "/solutions/compliance",
  "/solutions/customer-operations",
  "/solutions/multi-location",
  "/industries",
  "/industries/property-management",
  "/industries/healthcare-operations",
  "/industries/professional-services",
  "/industries/logistics",
  "/industries/franchises",
  "/pricing",
  "/security",
  "/resources",
  "/company",
  "/request-demo",
  "/start-trial",
  "/privacy",
  "/terms",
  "/services",
  "/services/ai",
  "/services/cybersecurity",
  "/services/compliance-governance",
  "/engagements",
  "/request-consultation",
];

for (const route of criticalRoutes) {
  test(`renders ${route} with a 200 response and a visible h1`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    await expect(page.locator("h1")).toBeVisible();
  });
}
