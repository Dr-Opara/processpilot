import { NextResponse } from "next/server";
import { getEvidenceDownloadUrl } from "@/lib/services/evidence";
import { toSafeErrorResponse } from "@/lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId } = await params;

  let signedUrl: string;
  try {
    signedUrl = await getEvidenceDownloadUrl(evidenceId);
  } catch (error) {
    const { status, body } = toSafeErrorResponse(error);
    return NextResponse.json(body, { status });
  }

  return NextResponse.redirect(signedUrl);
}
