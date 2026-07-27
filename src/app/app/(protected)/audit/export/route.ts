import { NextResponse } from "next/server";
import { exportAuditEvents } from "@/lib/services/audit";
import { toSafeErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  let csv: string;
  try {
    csv = await exportAuditEvents({
      action: searchParams.get("action") ?? undefined,
      resourceType: searchParams.get("resourceType") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });
  } catch (error) {
    const { status, body } = toSafeErrorResponse(error);
    return NextResponse.json(body, { status });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
