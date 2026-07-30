import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({ getCurrentProfile: vi.fn() }));

import { getCurrentProfile } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { isPlatformAdminEmail, requirePlatformAdmin } from "./platform-admin";

const ORIGINAL = process.env.PLATFORM_ADMIN_EMAILS;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = ORIGINAL;
  vi.mocked(getCurrentProfile).mockReset();
});

describe("isPlatformAdminEmail", () => {
  it("is false when PLATFORM_ADMIN_EMAILS is unset", () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    expect(isPlatformAdminEmail("owner@example.com")).toBe(false);
  });

  it("matches case-insensitively against the comma-separated allowlist", () => {
    process.env.PLATFORM_ADMIN_EMAILS = "Admin@Example.com, other@example.com";
    expect(isPlatformAdminEmail("admin@example.com")).toBe(true);
    expect(isPlatformAdminEmail("OTHER@EXAMPLE.COM")).toBe(true);
  });

  it("rejects an email not on the allowlist, however similar", () => {
    process.env.PLATFORM_ADMIN_EMAILS = "admin@example.com";
    expect(isPlatformAdminEmail("admin@example.com.evil.com")).toBe(false);
    expect(isPlatformAdminEmail("notadmin@example.com")).toBe(false);
  });
});

describe("requirePlatformAdmin", () => {
  it("rejects a real, authenticated user who is simply not on the allowlist", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "admin@example.com";
    vi.mocked(getCurrentProfile).mockResolvedValue({
      id: "profile-1",
      email: "regular-member@example.com",
    } as never);

    await expect(requirePlatformAdmin()).rejects.toThrow(AppError);
  });

  it("cannot be satisfied by anything short of the environment-variable allowlist — an org role/permission has no bearing here", async () => {
    // Demonstrates the core security property: this module never reads
    // organization_members/roles/permissions at all, so no tenant-role
    // grant (however broad) can produce a platform admin.
    process.env.PLATFORM_ADMIN_EMAILS = "admin@example.com";
    vi.mocked(getCurrentProfile).mockResolvedValue({
      id: "profile-1",
      email: "organization-owner@example.com",
    } as never);

    await expect(requirePlatformAdmin()).rejects.toThrow(/platform administration/i);
  });

  it("succeeds for an email on the allowlist", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "admin@example.com";
    const profile = { id: "profile-1", email: "admin@example.com" };
    vi.mocked(getCurrentProfile).mockResolvedValue(profile as never);

    await expect(requirePlatformAdmin()).resolves.toEqual(profile);
  });
});
