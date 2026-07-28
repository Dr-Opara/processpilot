import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSql, type FakeSql } from "@/lib/db/test-helpers/fake-sql";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ sql: undefined as unknown as FakeSql }));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: () => state.sql }));

const SECRET = "test-signing-secret";
process.env.SLACK_SIGNING_SECRET = SECRET;

import { createHmac } from "node:crypto";
import { POST } from "./route";

function sign(timestamp: string, body: string): string {
  return `v0=${createHmac("sha256", SECRET).update(`v0:${timestamp}:${body}`).digest("hex")}`;
}

function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/webhooks/integrations/slack", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

function signedRequest(body: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return request(body, {
    "x-slack-request-timestamp": timestamp,
    "x-slack-signature": sign(timestamp, body),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/webhooks/integrations/slack", () => {
  it("returns 400 without a valid signature", async () => {
    const response = await POST(request('{"type":"event_callback"}'));
    expect(response.status).toBe(400);
  });

  it("echoes the url_verification challenge", async () => {
    const body = JSON.stringify({ type: "url_verification", challenge: "abc123" });
    const response = await POST(signedRequest(body));
    const json = await response.json();
    expect(json).toEqual({ challenge: "abc123" });
  });

  it("dedupes a repeated event_id", async () => {
    const claimed = new Set<string>();
    state.sql = createFakeSql([
      {
        match: (t) => t.includes("insert into inbound_webhook_events"),
        respond: (values) => {
          const id = String(values[1]);
          if (claimed.has(id)) return [];
          claimed.add(id);
          return [{ id: `iwe_${id}` }];
        },
      },
      { match: (t) => t.includes("update inbound_webhook_events"), respond: () => [] },
    ]);

    const body = JSON.stringify({
      type: "event_callback",
      event_id: "Ev123",
      event: { type: "message" },
    });

    const first = await POST(signedRequest(body));
    const second = await POST(signedRequest(body));

    expect((await first.json()).deduped).toBe(false);
    expect((await second.json()).deduped).toBe(true);
  });
});
