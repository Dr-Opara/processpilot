import { NextResponse } from "next/server";
import { requestConsultationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = requestConsultationSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { ok: false, errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    devMode: true,
    message:
      "Development mode: this request was validated but not saved. No email was sent and no project record was created.",
  });
}
