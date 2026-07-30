import { test, expect } from "@playwright/test";

/**
 * Phase 22 (security hardening): proves the baseline security headers
 * configured in next.config.ts actually reach a real response, not just
 * that the config object is well-formed. Runs against the homepage —
 * no Clerk credentials needed, unlike e2e/app-auth.spec.ts.
 */
test("security headers are present on every response", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();

  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["strict-transport-security"]).toContain("max-age=");
});
