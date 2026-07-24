import { NextResponse } from "next/server";
import { uploadEvidence } from "@/lib/services/evidence";
import { toSafeErrorResponse } from "@/lib/errors";

/**
 * Multipart evidence upload — used both by a standalone 'evidence' task
 * node's uploader and by a form's `file`-type field (DynamicFormRenderer),
 * which needs the resulting evidenceId before the form itself can be
 * submitted. A plain fetch()-based API route, not a server action, since
 * a single field's upload has to resolve independently of the rest of an
 * in-progress form.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    const taskId = formData.get("taskId");
    const formSubmissionId = formData.get("formSubmissionId");
    const fieldKey = formData.get("fieldKey");
    const expiresAt = formData.get("expiresAt");

    const evidence = await uploadEvidence(
      {
        taskId: typeof taskId === "string" && taskId ? taskId : undefined,
        formSubmissionId:
          typeof formSubmissionId === "string" && formSubmissionId ? formSubmissionId : undefined,
        fieldKey: typeof fieldKey === "string" && fieldKey ? fieldKey : undefined,
        expiresAt: typeof expiresAt === "string" && expiresAt ? expiresAt : undefined,
      },
      { buffer, filename: file.name },
    );

    return NextResponse.json({
      id: evidence.id,
      originalFilename: evidence.original_filename,
      status: evidence.status,
    });
  } catch (error) {
    const { status, body } = toSafeErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
