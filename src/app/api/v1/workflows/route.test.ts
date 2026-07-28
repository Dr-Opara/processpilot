import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/api-keys", () => ({
  verifyApiKey: vi.fn(),
  checkRateLimit: vi.fn(),
  recordApiUsage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/tenant-context", () => ({ resolveApiTenantContext: vi.fn() }));
vi.mock("@/lib/services/public-api", () => ({ listWorkflowsForApi: vi.fn() }));

import { checkRateLimit, verifyApiKey } from "@/lib/services/api-keys";
import { resolveApiTenantContext } from "@/lib/api/tenant-context";
import { listWorkflowsForApi } from "@/lib/services/public-api";
import { GET } from "./route";

function request(url: string, authorization?: string) {
  return new NextRequest(url, { headers: authorization ? { authorization } : {} });
}

describe("GET /api/v1/workflows", () => {
  it("returns 401 without an Authorization header", async () => {
    const response = await GET(request("http://localhost/api/v1/workflows"));
    expect(response.status).toBe(401);
  });

  it("returns 403 when the key lacks workflows:read", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue({
      apiKeyId: "key-1",
      organizationId: "org-1",
      scopes: ["processes:read"],
      createdByProfileId: "profile-1",
    });
    const response = await GET(request("http://localhost/api/v1/workflows", "Bearer pp_live_ok"));
    expect(response.status).toBe(403);
  });

  it("returns a paginated envelope on success", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue({
      apiKeyId: "key-1",
      organizationId: "org-1",
      scopes: ["workflows:read"],
      createdByProfileId: "profile-1",
    });
    vi.mocked(checkRateLimit).mockResolvedValue({ limited: false, count: 1 });
    vi.mocked(resolveApiTenantContext).mockResolvedValue({
      organizationId: "org-1",
      memberId: "member-1",
      clerkUserId: "user_1",
    });
    vi.mocked(listWorkflowsForApi).mockResolvedValue({
      data: [
        {
          id: "workflow-1",
          organization_id: "org-1",
          department_id: null,
          process_id: "process-1",
          process_version_id: "pv-1",
          title: "Vendor onboarding run",
          status: "in_progress",
          started_by: null,
          started_at: "2026-08-04T00:00:00.000Z",
          due_at: null,
          completed_at: null,
          cancelled_at: null,
          cancelled_by: null,
          suspended_at: null,
          suspended_by: null,
        } as never,
      ],
      hasMore: true,
    });

    const response = await GET(request("http://localhost/api/v1/workflows", "Bearer pp_live_ok"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].id).toBe("workflow-1");
    expect(body.pagination.hasMore).toBe(true);
  });
});
