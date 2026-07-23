import { NextResponse } from "next/server";
import { generateErrorReport } from "@/lib/services/member-import";
import { toSafeErrorResponse } from "@/lib/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;

  let csv: string;
  try {
    csv = await generateErrorReport(batchId);
  } catch (error) {
    const { status, body } = toSafeErrorResponse(error);
    return NextResponse.json(body, { status });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="import-errors-${batchId}.csv"`,
    },
  });
}
