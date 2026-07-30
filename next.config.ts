import type { NextConfig } from "next";

/**
 * Phase 22 (security hardening): baseline browser/platform security
 * headers, applied to every response via next.config's headers() rather
 * than middleware, so they can never be skipped by a route that bypasses
 * src/middleware.ts's matcher. See
 * docs/architecture/security-hardening.md for the full rationale per
 * header and this file's one documented residual risk (CSP's
 * script-src/connect-src allowlist for Clerk's own domains is built from
 * Clerk's published CSP guidance, not verified against a live Clerk
 * instance in this environment — no real Clerk production domain is
 * configured here to test against, consistent with this codebase's
 * existing "credential-gated, unverified live" posture for every other
 * Clerk-dependent surface).
 *
 * 'unsafe-inline' on script-src is required because this app has no
 * nonce-based CSP wiring yet (Next.js's inline hydration script and
 * Clerk's own inline bootstrap script both need it) — tracked as a
 * known gap, not a silent omission.
 */
// Next.js's dev-mode React build calls eval() for its own debugging
// features (never in a production build, per React's own runtime
// warning) — 'unsafe-eval' is added only outside production so `npm
// run dev`/Codespaces stay usable without weakening the CSP actually
// shipped to users.
const isProduction = process.env.NODE_ENV === "production";
const CSP_DIRECTIVES = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isProduction ? "" : "'unsafe-eval' "}https://*.clerk.accounts.dev https://*.clerk.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.clerk.com",
  "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS only matters (and is only safe to assert) over an actual HTTPS
  // deployment — Vercel terminates TLS in front of every real deployment
  // this app has, including preview URLs, so this is safe to send
  // unconditionally rather than environment-gated.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

// Phase 23 (caching): every authenticated/tenant-scoped surface is
// explicitly marked non-cacheable by any shared/proxy cache — the
// default Next.js caching behavior is safe for the public marketing
// routes (left untouched, on Next's own static-optimization defaults)
// but every one of these carries organization-scoped data that must
// never be served from a shared CDN/browser-disk cache to a different
// user. See docs/architecture/performance-and-caching.md.
const NO_STORE_HEADER = { key: "Cache-Control", value: "private, no-store" };
const PRIVATE_SOURCES = ["/app/:path*", "/api/v1/:path*", "/api/scim/:path*", "/api/jobs/:path*"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      ...PRIVATE_SOURCES.map((source) => ({
        source,
        headers: [NO_STORE_HEADER],
      })),
    ];
  },
};

export default nextConfig;
