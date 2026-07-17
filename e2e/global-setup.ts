import { clerkSetup } from "@clerk/testing/playwright";

/**
 * Fetches a Clerk testing token so e2e/app-auth.spec.ts can bypass bot
 * protection during sign-in. Guarded rather than unconditional: without
 * CLERK_SECRET_KEY set (e.g. before the Clerk account is fully wired up
 * across Codespaces/Actions/Vercel secrets, per
 * docs/development/environment-variables.md), clerkSetup() throws, which
 * would otherwise abort the entire e2e suite — including the ~40
 * marketing-site assertions that have nothing to do with Clerk.
 */
export default async function globalSetup() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.warn(
      "CLERK_SECRET_KEY is not set — skipping Clerk test setup. " +
        "e2e/app-auth.spec.ts will fail; every other e2e spec is unaffected.",
    );
    return;
  }

  await clerkSetup();
}
