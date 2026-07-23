import { NextResponse } from "next/server";
import { getDownloadUrl } from "@/lib/services/document-versions";
import { toSafeErrorResponse } from "@/lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;

  let signedUrl: string;
  try {
    signedUrl = await getDownloadUrl(versionId);
  } catch (error) {
    const { status, body } = toSafeErrorResponse(error);
    return NextResponse.json(body, { status });
  }

  return NextResponse.redirect(signedUrl);
}
