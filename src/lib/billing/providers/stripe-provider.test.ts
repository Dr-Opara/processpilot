import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const stripeClientMock = vi.hoisted(() => ({
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  subscriptions: { update: vi.fn(), cancel: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function StripeMock() {
    return stripeClientMock;
  }),
}));

import { StripeProvider } from "./stripe-provider";

const ORIGINAL_SECRET = process.env.STRIPE_SECRET_KEY;
const ORIGINAL_WEBHOOK = process.env.STRIPE_WEBHOOK_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = ORIGINAL_SECRET;
  if (ORIGINAL_WEBHOOK === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_WEBHOOK;
  vi.clearAllMocks();
});

function configure() {
  process.env.STRIPE_SECRET_KEY = "sk_test_real_looking_value";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_real_looking_value";
}

describe("StripeProvider", () => {
  it("creates a customer", async () => {
    configure();
    stripeClientMock.customers.create.mockResolvedValue({ id: "cus_1" });

    const result = await new StripeProvider().createCustomer({
      organizationId: "org-1",
      email: "owner@example.com",
      name: "Acme Co",
    });

    expect(result.customerId).toBe("cus_1");
    expect(stripeClientMock.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: "owner@example.com" }),
    );
  });

  it("returns the checkout session url", async () => {
    configure();
    stripeClientMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/1",
    });

    const result = await new StripeProvider().createCheckoutSession({
      customerId: "cus_1",
      priceId: "price_1",
      successUrl: "https://app.example.com/success",
      cancelUrl: "https://app.example.com/cancel",
    });

    expect(result.url).toBe("https://checkout.stripe.com/1");
  });

  it("throws if Stripe returns no checkout session url", async () => {
    configure();
    stripeClientMock.checkout.sessions.create.mockResolvedValue({ url: null });

    await expect(
      new StripeProvider().createCheckoutSession({
        customerId: "cus_1",
        priceId: "price_1",
        successUrl: "https://app.example.com/success",
        cancelUrl: "https://app.example.com/cancel",
      }),
    ).rejects.toThrow();
  });

  it("cancels at period end vs. immediately based on the input flag", async () => {
    configure();
    const provider = new StripeProvider();

    await provider.cancelSubscription({ subscriptionId: "sub_1", atPeriodEnd: true });
    expect(stripeClientMock.subscriptions.update).toHaveBeenCalledWith("sub_1", {
      cancel_at_period_end: true,
    });

    await provider.cancelSubscription({ subscriptionId: "sub_1", atPeriodEnd: false });
    expect(stripeClientMock.subscriptions.cancel).toHaveBeenCalledWith("sub_1");
  });

  it("normalizes a verified subscription webhook event", () => {
    configure();
    stripeClientMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: {
        object: {
          object: "subscription",
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          cancel_at_period_end: false,
          trial_end: null,
          items: {
            data: [
              {
                price: { id: "price_1" },
                current_period_start: 1700000000,
                current_period_end: 1702592000,
              },
            ],
          },
        },
      },
    });

    const event = new StripeProvider().verifyAndParseWebhook("{}", "sig_test");

    expect(event.subscription).toEqual(
      expect.objectContaining({ subscriptionId: "sub_1", customerId: "cus_1", priceId: "price_1" }),
    );
  });

  it("returns a null subscription for a non-subscription event object", () => {
    configure();
    stripeClientMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_2",
      type: "invoice.paid",
      data: { object: { object: "invoice" } },
    });

    const event = new StripeProvider().verifyAndParseWebhook("{}", "sig_test");

    expect(event.subscription).toBeNull();
  });

  it("throws without calling Stripe when unconfigured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    await expect(
      new StripeProvider().createCustomer({
        organizationId: "org-1",
        email: "a@b.com",
        name: "Acme",
      }),
    ).rejects.toThrow();
    expect(stripeClientMock.customers.create).not.toHaveBeenCalled();
  });
});
