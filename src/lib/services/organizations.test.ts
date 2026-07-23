import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { createFakeSql, asTransactionSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { AppError } from "@/lib/errors";
import type { OnboardingStep } from "@/lib/db/database.types";
import { advanceOnboardingStep, updateCompanyProfile } from "./organizations";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) => fn(asTransactionSql(fakeSql)));
  return fakeSql;
}

const validProfileInput = {
  name: "Acme Co",
  legalName: null,
  slug: "acme-co",
  industry: null,
  employeeCountRange: null,
  websiteUrl: "",
  country: null,
  timezone: "America/New_York",
  dateFormat: "MM/DD/YYYY",
  weekStart: "monday" as const,
  primaryUseCase: null,
};

describe("organizations service", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("rejects a company-profile update whose slug is already used by another organization", async () => {
    const membership = makeMembership({ permissions: ["organization.settings"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      { match: (t) => t.includes("select id from organizations where lower(slug)"), respond: () => [{ id: "other-org" }] },
    ]);

    await expect(updateCompanyProfile(validProfileInput)).rejects.toThrow("already in use");
  });

  it("updates the company profile and organization settings together when the slug is free", async () => {
    const membership = makeMembership({ permissions: ["organization.settings"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select id from organizations where lower(slug)"), respond: () => [] },
      {
        match: (t) => t.includes("update organizations set"),
        respond: () => [{ id: "org-1", name: "Acme Co", slug: "acme-co" }],
      },
      {
        match: (t) => t.includes("update organization_settings set"),
        respond: () => [{ organization_id: "org-1", timezone: "America/New_York" }],
      },
    ]);

    const result = await updateCompanyProfile(validProfileInput);

    expect(result.organization).toEqual({ id: "org-1", name: "Acme Co", slug: "acme-co" });
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("rejects updateCompanyProfile when the caller lacks organization.settings", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: organization.settings"),
    );
    wireTenantContext();

    await expect(updateCompanyProfile(validProfileInput)).rejects.toThrow("Missing permission");
  });

  it("rejects an unknown onboarding step before checking permissions", async () => {
    const bogusStep = "not_a_real_step" as unknown as OnboardingStep;
    await expect(advanceOnboardingStep(bogusStep)).rejects.toThrow("Unknown onboarding step");
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it("marks onboarding completed only when the step is 'finished'", async () => {
    const membership = makeMembership({ permissions: ["organization.settings"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("update organization_settings set"),
        respond: () => [{ organization_id: "org-1", onboarding_step: "finished" }],
      },
    ]);

    await advanceOnboardingStep("finished");

    const updateCall = fakeSql.calls.find((c) => c.text.includes("update organization_settings set"));
    expect(updateCall?.text).toContain("onboarding_completed_at");
  });
});
