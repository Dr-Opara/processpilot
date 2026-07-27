import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

const adminState = vi.hoisted(() => ({
  sql: undefined as unknown as ReturnType<typeof import("@/lib/db/test-helpers/fake-sql").asSql>,
}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: () => adminState.sql }));

vi.mock("@/lib/billing/availability", () => ({ isBillingConfigured: vi.fn() }));
vi.mock("@/lib/billing/get-provider", () => ({ getBillingProvider: vi.fn() }));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { isBillingConfigured } from "@/lib/billing/availability";
import { getBillingProvider } from "@/lib/billing/get-provider";
import {
  createFakeSql,
  asTransactionSql,
  asSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { AppError } from "@/lib/errors";
import {
  cancelCurrentSubscription,
  createBillingPortalUrl,
  createCheckoutSessionUrl,
  getAiUsageForCurrentPeriod,
  getCurrentSubscription,
  getEntitlements,
  hasFeature,
  requireSeatAvailable,
} from "./billing";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

function wireAdminSql(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  adminState.sql = asSql(fakeSql);
  return fakeSql;
}

beforeEach(() => {
  vi.mocked(getCurrentMembership).mockReset();
  vi.mocked(requirePermission).mockReset();
  vi.mocked(isBillingConfigured).mockReset();
  vi.mocked(getBillingProvider).mockReset();
});

describe("getCurrentSubscription", () => {
  it("requires billing.manage and returns null when there's no active subscription", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["billing.manage"] }),
    );
    wireTenantContext([{ match: (t) => t.includes("from subscriptions"), respond: () => [] }]);

    expect(await getCurrentSubscription()).toBeNull();
  });
});

describe("getEntitlements", () => {
  it("falls back to the starter (default) plan when there's no subscription", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireAdminSql([{ match: (t) => t.includes("from subscriptions"), respond: () => [] }]);

    const entitlements = await getEntitlements();

    expect(entitlements.maxSeats).toBe(10);
  });

  it("resolves the plan tied to an active subscription", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireAdminSql([
      {
        match: (t) => t.includes("from subscriptions"),
        respond: () => [{ plan_key: "enterprise", status: "active" }],
      },
    ]);

    const entitlements = await getEntitlements();

    expect(entitlements.maxSeats).toBeNull();
  });
});

describe("requireSeatAvailable", () => {
  it("throws once active seats reach the plan limit", async () => {
    wireAdminSql([
      { match: (t) => t.includes("from subscriptions"), respond: () => [] }, // starter: maxSeats 10
      { match: (t) => t.includes("from organization_members"), respond: () => [{ count: "10" }] },
    ]);

    await expect(requireSeatAvailable("org-1")).rejects.toThrow(AppError);
  });

  it("allows an invite below the seat limit", async () => {
    wireAdminSql([
      { match: (t) => t.includes("from subscriptions"), respond: () => [] },
      { match: (t) => t.includes("from organization_members"), respond: () => [{ count: "3" }] },
    ]);

    await expect(requireSeatAvailable("org-1")).resolves.toBeUndefined();
  });

  it("never throws for an unlimited (enterprise) plan", async () => {
    wireAdminSql([
      {
        match: (t) => t.includes("from subscriptions"),
        respond: () => [{ plan_key: "enterprise", status: "active" }],
      },
    ]);

    await expect(requireSeatAvailable("org-1")).resolves.toBeUndefined();
  });
});

describe("hasFeature", () => {
  it("checks membership in the plan's feature set", () => {
    const entitlements = {
      label: "x",
      maxSeats: null,
      aiRequestsPerMonth: null,
      features: new Set(["analytics"]),
    };
    expect(hasFeature(entitlements, "analytics")).toBe(true);
    expect(hasFeature(entitlements, "sso")).toBe(false);
  });
});

describe("getAiUsageForCurrentPeriod", () => {
  it("counts this month's ai_usage_events rows", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["billing.manage"] }),
    );
    wireTenantContext([
      { match: (t) => t.includes("from ai_usage_events"), respond: () => [{ count: "12" }] },
    ]);

    expect(await getAiUsageForCurrentPeriod()).toBe(12);
  });
});

describe("createCheckoutSessionUrl", () => {
  it("throws when no Stripe price is configured for the plan", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["billing.manage"] }),
    );

    await expect(
      createCheckoutSessionUrl("starter", "https://x/success", "https://x/cancel"),
    ).rejects.toThrow(AppError);
  });

  it("creates a Stripe customer when the org has none, then returns the checkout url", async () => {
    process.env.STRIPE_PRICE_ID_BUSINESS = "price_business";
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["billing.manage"] }),
    );
    vi.mocked(isBillingConfigured).mockReturnValue(true);
    const createCustomer = vi.fn().mockResolvedValue({ customerId: "cus_new" });
    const createCheckoutSession = vi
      .fn()
      .mockResolvedValue({ url: "https://checkout.stripe.com/1" });
    vi.mocked(getBillingProvider).mockReturnValue({
      name: "stripe",
      createCustomer,
      createCheckoutSession,
      createBillingPortalSession: vi.fn(),
      cancelSubscription: vi.fn(),
      verifyAndParseWebhook: vi.fn(),
    });
    wireAdminSql([{ match: (t) => t.includes("update organizations"), respond: () => [] }]);

    const url = await createCheckoutSessionUrl("business", "https://x/success", "https://x/cancel");

    expect(url).toBe("https://checkout.stripe.com/1");
    expect(createCustomer).toHaveBeenCalled();
    delete process.env.STRIPE_PRICE_ID_BUSINESS;
  });
});

describe("createBillingPortalUrl", () => {
  it("throws when billing isn't configured", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["billing.manage"] }),
    );
    vi.mocked(isBillingConfigured).mockReturnValue(false);

    await expect(createBillingPortalUrl("https://x/return")).rejects.toThrow(AppError);
  });
});

describe("cancelCurrentSubscription", () => {
  it("throws when there is no active subscription to cancel", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["billing.manage"] }),
    );
    vi.mocked(isBillingConfigured).mockReturnValue(true);
    wireTenantContext([{ match: (t) => t.includes("from subscriptions"), respond: () => [] }]);

    await expect(cancelCurrentSubscription(true)).rejects.toThrow(AppError);
  });
});
