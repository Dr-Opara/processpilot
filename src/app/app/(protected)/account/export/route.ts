import { NextResponse } from "next/server";
import { exportMyData } from "@/lib/services/legal";
import { toSafeErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const data = await exportMyData();
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="my-processpilot-data.json"',
      },
    });
  } catch (error) {
    const { status, body } = toSafeErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
