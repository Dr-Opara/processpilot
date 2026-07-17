/**
 * Fixed /app/* paths (see src/app/layout.tsx for why these aren't
 * host-detected: that would force the whole marketing site dynamic).
 * The authenticated app also lives at app.processpilot.com in production
 * per product/information-architecture.md and ADR-0002, once a custom
 * domain is configured (see middleware.ts) — until then these path-based
 * routes are the only entry point, and remain reachable (with a redundant
 * "/app" segment) even after that.
 */
export const SIGN_IN_PATH = "/app/sign-in";
export const SIGN_UP_PATH = "/app/sign-up";
export const DASHBOARD_PATH = "/app";
