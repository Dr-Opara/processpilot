import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authz";
import { getImportTemplate } from "@/lib/services/member-import";
import { toSafeErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    await requirePermission("member.invite");
  } catch (error) {
    const { status, body } = toSafeErrorResponse(error);
    return NextResponse.json(body, { status });
  }

  return new NextResponse(getImportTemplate(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="member-import-template.csv"',
    },
  });
}
