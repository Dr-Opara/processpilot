import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { getStripeSecretKey, getStripeWebhookSecret, isBillingConfigured } from "./availability";

const ORIGINAL_SECRET = process.env.STRIPE_SECRET_KEY;
const ORIGINAL_WEBHOOK = process.env.STRIPE_WEBHOOK_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = ORIGINAL_SECRET;
  if (ORIGINAL_WEBHOOK === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_WEBHOOK;
});

describe("isBillingConfigured", () => {
  it("is false when the secret key is missing", () => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_real_looking_value";
    expect(isBillingConfigured()).toBe(false);
  });

  it("is false when the webhook secret is missing", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_real_looking_value";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(isBillingConfigured()).toBe(false);
  });

  it("is false for the documented .env.local placeholder", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_replace_me";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_real_looking_value";
    expect(isBillingConfigured()).toBe(false);
  });

  it("is true for keys that don't match a known placeholder pattern", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_real_looking_value";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_real_looking_value";
    expect(isBillingConfigured()).toBe(true);
  });
});

describe("getStripeSecretKey / getStripeWebhookSecret", () => {
  it("throws when not configured", () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(() => getStripeSecretKey()).toThrow();
    expect(() => getStripeWebhookSecret()).toThrow();
  });

  it("returns the configured values", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_real_looking_value";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_real_looking_value";
    expect(getStripeSecretKey()).toBe("sk_test_real_looking_value");
    expect(getStripeWebhookSecret()).toBe("whsec_real_looking_value");
  });
});
