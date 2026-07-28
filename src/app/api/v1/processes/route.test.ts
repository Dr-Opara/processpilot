import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/api-keys", () => ({
  verifyApiKey: vi.fn(),
  checkRateLimit: vi.fn(),
  recordApiUsage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/tenant-context", () => ({ resolveApiTenantContext: vi.fn() }));
vi.mock("@/lib/services/public-api", () => ({ listProcessesForApi: vi.fn() }));

import { checkRateLimit, verifyApiKey } from "@/lib/services/api-keys";
import { resolveApiTenantContext } from "@/lib/api/tenant-context";
import { listProcessesForApi } from "@/lib/services/public-api";
import { GET } from "./route";

function request(url: string, authorization?: string) {
  return new NextRequest(url, { headers: authorization ? { authorization } : {} });
}

describe("GET /api/v1/processes", () => {
  it("returns 401 without an Authorization header", async () => {
    const response = await GET(request("http://localhost/api/v1/processes"));
    expect(response.status).toBe(401);
  });

  it("returns 401 for an invalid key", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(null);
    const response = await GET(request("http://localhost/api/v1/processes", "Bearer pp_live_bad"));
    expect(response.status).toBe(401);
  });

  it("returns 403 when the key lacks the required scope", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue({
      apiKeyId: "key-1",
      organizationId: "org-1",
      scopes: ["workflows:read"],
      createdByProfileId: "profile-1",
    });
    const response = await GET(request("http://localhost/api/v1/processes", "Bearer pp_live_ok"));
    expect(response.status).toBe(403);
  });

  it("returns 429 when rate-limited", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue({
      apiKeyId: "key-1",
      organizationId: "org-1",
      scopes: ["processes:read"],
      createdByProfileId: "profile-1",
    });
    vi.mocked(checkRateLimit).mockResolvedValue({ limited: true, count: 60 });
    const response = await GET(request("http://localhost/api/v1/processes", "Bearer pp_live_ok"));
    expect(response.status).toBe(429);
  });

  it("returns a paginated envelope on success", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue({
      apiKeyId: "key-1",
      organizationId: "org-1",
      scopes: ["processes:read"],
      createdByProfileId: "profile-1",
    });
    vi.mocked(checkRateLimit).mockResolvedValue({ limited: false, count: 1 });
    vi.mocked(resolveApiTenantContext).mockResolvedValue({
      organizationId: "org-1",
      memberId: "member-1",
      clerkUserId: "user_1",
    });
    vi.mocked(listProcessesForApi).mockResolvedValue({
      data: [
        {
          id: "process-1",
          organization_id: "org-1",
          title: "Vendor onboarding",
          description: null,
          category: null,
          tags: [],
          owner_member_id: null,
          department_id: null,
          location_id: null,
          team_id: null,
          sla_hours: null,
          effective_from: null,
          effective_until: null,
          source_document_ids: [],
          status: "published",
          current_version_id: null,
          created_at: "2026-08-04T00:00:00.000Z",
          updated_at: "2026-08-04T00:00:00.000Z",
          created_by: null,
          archived_at: null,
        },
      ],
      hasMore: false,
    });

    const response = await GET(
      request("http://localhost/api/v1/processes?limit=10", "Bearer pp_live_ok"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("process-1");
    expect(body.pagination).toEqual({ limit: 10, offset: 0, hasMore: false });
  });
});
