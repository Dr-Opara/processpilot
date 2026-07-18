import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * The authenticated app lives at app.processpilot.com per
 * product/information-architecture.md and ADR-0002 (one Next.js app
 * serves both domains). No custom domain is configured yet, so this only
 * rewrites when a request's host actually starts with "app." (real
 * production). Everywhere else — Codespaces, Vercel preview URLs,
 * localhost, none of which can have that subdomain — the routes under
 * src/app/app/ are reachable directly at /app/* by path, so the
 * authenticated app stays testable without special DNS. See
 * docs/architecture/deployment-architecture.md.
 *
 * Route protection itself is NOT done here — createRouteMatcher-based
 * middleware auth checks are deprecated in this Clerk SDK version in
 * favor of resource-based checks in each protected layout/page/route
 * handler (see src/app/app/(protected)/layout.tsx), which also matches
 * this project's "server-enforced, always, on every request" rule in
 * docs/architecture/authentication-and-authorization.md rather than
 * relying on a single path-matching gate.
 */
const APP_HOST_PREFIX = "app.";

export default clerkMiddleware(async (_auth, req) => {
  const host = req.headers.get("host") ?? "";
  const url = req.nextUrl;

  if (host.startsWith(APP_HOST_PREFIX) && !url.pathname.startsWith("/app")) {
    const rewritten = url.clone();
    rewritten.pathname = url.pathname === "/" ? "/app" : `/app${url.pathname}`;
    return NextResponse.rewrite(rewritten);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets, always run for API/app routes.
    "/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
