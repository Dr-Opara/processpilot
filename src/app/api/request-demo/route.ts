import { NextResponse } from "next/server";
import { requestDemoSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = requestDemoSchema.safeParse(body);

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
      "Development mode: this request was validated but not saved. No email was sent and no sales record was created.",
  });
}
