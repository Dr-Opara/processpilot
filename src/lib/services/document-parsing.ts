import "server-only";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { AppError } from "@/lib/errors";

/**
 * Untrusted-upload validation and text extraction for knowledge
 * documents. Mirrors member-import.ts's "never trust the client"
 * posture for CSV uploads — every check here re-verifies the file's
 * actual bytes, never just its declared extension/mime type.
 */
export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

export type UploadKind = "pdf" | "docx" | "text";

const PDF_MAGIC = Buffer.from("%PDF-");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export function detectUploadKind(buffer: Buffer, filename: string): UploadKind {
  const extension = filename.toLowerCase().split(".").pop();

  if (buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    if (extension !== "pdf") {
      throw new AppError("conflict", "This file's contents don't match a PDF despite its name.");
    }
    return "pdf";
  }

  if (buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
    if (extension !== "docx") {
      throw new AppError("conflict", "This file's contents don't match a DOCX despite its name.");
    }
    return "docx";
  }

  if (extension === "txt" || extension === "text") {
    return "text";
  }

  throw new AppError("conflict", "Only PDF, DOCX, and plain text files are supported for upload.");
}

export function validateUpload(buffer: Buffer, filename: string): UploadKind {
  if (buffer.byteLength === 0) {
    throw new AppError("conflict", "The uploaded file is empty.");
  }
  if (buffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    throw new AppError("conflict", "Files are limited to 20 MB.");
  }
  return detectUploadKind(buffer, filename);
}

export function mimeTypeForKind(kind: UploadKind): string {
  switch (kind) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "text":
      return "text/plain";
  }
}

export async function extractTextFromUpload(buffer: Buffer, kind: UploadKind): Promise<string> {
  switch (kind) {
    case "text":
      return buffer.toString("utf8");
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "pdf": {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        await parser.destroy();
      }
    }
  }
}
