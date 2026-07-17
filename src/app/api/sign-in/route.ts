import { NextResponse } from "next/server";
import { signInSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = signInSchema.safeParse(body);

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
      "Development mode: credentials were validated for format only. Authentication is not implemented yet, so no session was created.",
  });
}
