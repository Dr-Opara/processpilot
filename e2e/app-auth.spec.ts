import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

/**
 * Requires a Clerk test-mode instance (test-mode keys — see
 * docs/development/environment-variables.md and e2e/global-setup.ts,
 * which skips Clerk setup entirely if CLERK_SECRET_KEY or
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY isn't set) and one pre-existing test
 * user in that same Clerk instance, identified by E2E_CLERK_USER_EMAIL.
 * Signs in via clerk.signIn's server-side ticket flow (Clerk looks the
 * user up by email and issues a sign-in token via the Backend API) rather
 * than the client-side password/email_code flow: this Clerk instance
 * requires client-trust verification on fresh sign-in attempts
 * ("needs_client_trust"), which the client-side signInParams flow can't
 * satisfy — @clerk/testing's own docs note that path only handles first-
 * factor verification. The ticket flow bypasses verification entirely,
 * so no password is needed. The sign-in test below skips itself when any
 * of those three environment variables aren't present, instead of
 * failing the workflow.
 */
const TEST_USER_EMAIL = process.env.E2E_CLERK_USER_EMAIL;
const CLERK_TEST_ENV_AVAILABLE = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && TEST_USER_EMAIL,
);

test("an unauthenticated request to the app is redirected to sign-in", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/sign-in/);
});

test("a signed-in user can reach the dashboard", async ({ page }) => {
  test.skip(
    !CLERK_TEST_ENV_AVAILABLE,
    "Requires CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, and E2E_CLERK_USER_EMAIL",
  );

  await page.goto("/app/sign-in");
  await clerk.signIn({
    page,
    emailAddress: TEST_USER_EMAIL as string,
  });

  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();

  await clerk.signOut({ page });
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/sign-in/);
});
