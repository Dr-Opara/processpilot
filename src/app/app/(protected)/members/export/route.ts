import { NextResponse } from "next/server";
import { exportMembers } from "@/lib/services/member-export";
import { toSafeErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const csv = await exportMembers();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="members.csv"',
      },
    });
  } catch (error) {
    const { status, body } = toSafeErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
