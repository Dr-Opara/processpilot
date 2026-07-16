import { NextResponse } from "next/server";
import { startTrialSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = startTrialSchema.safeParse(body);

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
      "Development mode: this signup was validated but no account was created. No email was sent and no password was stored.",
  });
}
