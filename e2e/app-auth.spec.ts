import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

/**
 * Requires a Clerk test-mode instance (test-mode keys — see
 * docs/development/environment-variables.md and e2e/global-setup.ts,
 * which skips Clerk setup entirely if CLERK_SECRET_KEY or
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY isn't set) and one pre-existing test
 * user. Create it once in the Clerk dashboard using a "+clerk_test@"
 * email (e.g. e2e+clerk_test@processpilot.dev) — Clerk's test mode
 * accepts the fixed code 424242 for any such address, so no real inbox
 * is needed. The sign-in test below skips itself when those two
 * environment variables aren't both present, instead of failing the
 * workflow.
 */
const TEST_USER_EMAIL = "e2e+clerk_test@processpilot.dev";
const CLERK_TEST_ENV_AVAILABLE = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

test("an unauthenticated request to the app is redirected to sign-in", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/sign-in/);
});

test("a signed-in user can reach the dashboard", async ({ page }) => {
  test.skip(
    !CLERK_TEST_ENV_AVAILABLE,
    "Requires CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY test-mode credentials",
  );

  await page.goto("/app/sign-in");
  await clerk.signIn({
    page,
    signInParams: { strategy: "email_code", identifier: TEST_USER_EMAIL },
  });

  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();

  await clerk.signOut({ page });
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/sign-in/);
});
