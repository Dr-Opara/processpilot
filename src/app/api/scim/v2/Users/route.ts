import { NextResponse } from "next/server";
import { verifyScimToken, listScimUsers } from "@/lib/services/scim";

/**
 * GET /api/scim/v2/Users — minimal SCIM 2.0 Users list resource. See
 * src/lib/services/scim.ts's header comment for exactly how bounded
 * this is (list-only, no filter/PATCH/Groups/ServiceProviderConfig).
 * Bearer-token authenticated by a dedicated scim_tokens row, never a
 * ProcessPilot session or public API key — a SCIM client is a different
 * trust boundary from either.
 */
function scimError(status: number, detail: string) {
  return NextResponse.json(
    { schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail, status: String(status) },
    { status },
  );
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  if (!rawToken) return scimError(401, "Missing Authorization header.");

  const auth = await verifyScimToken(rawToken);
  if (!auth) return scimError(401, "Invalid or revoked SCIM token.");

  const url = new URL(request.url);
  const startIndex = Math.max(Number(url.searchParams.get("startIndex")) || 1, 1);
  const count = Math.min(Math.max(Number(url.searchParams.get("count")) || 20, 1), 100);

  const { users, totalResults } = await listScimUsers(auth.organizationId, { startIndex, count });

  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults,
    startIndex,
    itemsPerPage: users.length,
    Resources: users.map((user) => ({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: user.id,
      userName: user.userName,
      name: { givenName: user.name.givenName, familyName: user.name.familyName },
      active: user.active,
    })),
  });
}
