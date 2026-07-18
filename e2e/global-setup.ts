import { clerkSetup } from "@clerk/testing/playwright";

/**
 * Fetches a Clerk testing token so e2e/app-auth.spec.ts can bypass bot
 * protection during sign-in. Guarded rather than unconditional: without
 * both CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY set (e.g.
 * before the Clerk account is fully wired up across Codespaces/Actions/
 * Vercel secrets, per docs/development/environment-variables.md),
 * clerkSetup() throws, which would otherwise abort the entire e2e suite —
 * including the ~40 marketing-site assertions that have nothing to do
 * with Clerk. e2e/app-auth.spec.ts checks the same two variables and
 * skips its Clerk-dependent test itself when they're absent.
 */
export default async function globalSetup() {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    console.warn(
      "CLERK_SECRET_KEY and/or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — skipping Clerk test setup. " +
        "Clerk-dependent e2e tests will skip themselves; every other e2e spec is unaffected.",
    );
    return;
  }

  await clerkSetup();
}
