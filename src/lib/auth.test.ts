import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { requireAuth } from "./auth";

// server-only's real implementation throws outside Next's RSC bundling
// pipeline, which Vitest's jsdom environment isn't — the guard itself
// (production code keeps `import "server-only"` in auth.ts) is what's
// being bypassed here, not tested.
vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

describe("requireAuth", () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
    vi.mocked(auth).mockReset();
  });

  it("redirects signed-out callers to /app/sign-in", async () => {
    vi.mocked(auth).mockResolvedValue(
      // Only userId is read by requireAuth; the rest of Clerk's real
      // SignedOutAuthObject shape is irrelevant here.
      { userId: null } as unknown as Awaited<ReturnType<typeof auth>>,
    );

    await requireAuth();

    expect(redirect).toHaveBeenCalledWith("/app/sign-in");
  });

  it("returns the session and does not redirect when signed in", async () => {
    const session = { userId: "user_123", orgId: "org_456" };
    vi.mocked(auth).mockResolvedValue(session as unknown as Awaited<ReturnType<typeof auth>>);

    const result = await requireAuth();

    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual(session);
  });
});
