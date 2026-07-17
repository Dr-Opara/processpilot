import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Standard Webhooks signing (the scheme Clerk's verifyWebhook checks
// against) — signed content is "{id}.{timestamp}.{payload}", HMAC-SHA256
// over the base64-decoded secret (after its "whsec_" prefix), base64
// encoded, prefixed "v1,". No svix package needed to construct this in
// tests; it's a stable, documented spec.
const TEST_SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

function sign(id: string, timestamp: string, payload: string, secret: string) {
  const secretBytes = Buffer.from(secret.split("_")[1], "base64");
  const signedContent = `${id}.${timestamp}.${payload}`;
  const signature = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  return `v1,${signature}`;
}

function webhookRequest(headers: Record<string, string>, payload: string) {
  return new NextRequest("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: payload,
  });
}

describe("POST /api/webhooks/clerk", () => {
  const originalSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  beforeAll(() => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = originalSecret;
  });

  it("accepts a validly signed payload and returns 200", async () => {
    const payload = JSON.stringify({ type: "organization.created", data: { id: "org_test123" } });
    const id = "msg_test";
    const timestamp = String(Math.floor(Date.now() / 1000));

    const response = await POST(
      webhookRequest(
        {
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": sign(id, timestamp, payload, TEST_SECRET),
        },
        payload,
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  it("rejects a payload with an invalid signature", async () => {
    const payload = JSON.stringify({ type: "organization.created", data: { id: "org_test123" } });
    const id = "msg_test";
    const timestamp = String(Math.floor(Date.now() / 1000));

    const response = await POST(
      webhookRequest(
        {
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": "v1,not-a-real-signature",
        },
        payload,
      ),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a request missing signature headers entirely", async () => {
    const payload = JSON.stringify({ type: "organization.created", data: { id: "org_test123" } });

    const response = await POST(webhookRequest({}, payload));

    expect(response.status).toBe(400);
  });
});
