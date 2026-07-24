import "server-only";
import { AppError } from "@/lib/errors";

/**
 * Untrusted-upload validation for evidence files — broader than
 * document-parsing.ts's knowledge-document validator (evidence covers
 * photos, videos, and office documents, not just PDF/DOCX/text), but
 * the same "never trust the client" posture: every check re-verifies
 * the file's actual bytes, never just its declared extension/mime type.
 */
export const MAX_EVIDENCE_SIZE_BYTES = 25 * 1024 * 1024;

interface Signature {
  mimeType: string;
  extensions: string[];
  matches: (buffer: Buffer) => boolean;
}

const SIGNATURES: Signature[] = [
  {
    mimeType: "image/jpeg",
    extensions: ["jpg", "jpeg"],
    matches: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  {
    mimeType: "image/png",
    extensions: ["png"],
    matches: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: "image/gif",
    extensions: ["gif"],
    matches: (b) => b.subarray(0, 4).toString("ascii") === "GIF8",
  },
  {
    mimeType: "image/webp",
    extensions: ["webp"],
    matches: (b) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
  {
    mimeType: "application/pdf",
    extensions: ["pdf"],
    matches: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-",
  },
  {
    mimeType: "video/mp4",
    extensions: ["mp4"],
    matches: (b) => b.subarray(4, 8).toString("ascii") === "ftyp",
  },
  {
    // Covers docx/xlsx/pptx — all ZIP containers; declared extension
    // decides the specific mime type since the magic bytes are identical.
    mimeType: "application/zip",
    extensions: ["docx", "xlsx", "pptx", "zip"],
    matches: (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  },
];

const OFFICE_MIME_BY_EXTENSION: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

export interface ValidatedEvidenceUpload {
  mimeType: string;
}

export function validateEvidenceUpload(buffer: Buffer, filename: string): ValidatedEvidenceUpload {
  if (buffer.byteLength === 0) throw new AppError("conflict", "The uploaded file is empty.");
  if (buffer.byteLength > MAX_EVIDENCE_SIZE_BYTES) {
    throw new AppError("conflict", "Evidence files are limited to 25 MB.");
  }

  const extension = filename.toLowerCase().split(".").pop() ?? "";

  if (extension === "txt" || extension === "text" || extension === "csv") {
    // No reliable magic bytes for plain text — reject anything that
    // isn't valid UTF-8-ish plain text by checking for embedded NUL
    // bytes, a strong signal the declared extension is wrong.
    if (buffer.includes(0x00)) {
      throw new AppError(
        "conflict",
        "This file's contents don't match a text file despite its name.",
      );
    }
    return { mimeType: extension === "csv" ? "text/csv" : "text/plain" };
  }

  const signature = SIGNATURES.find((candidate) => candidate.matches(buffer));
  if (!signature) {
    throw new AppError(
      "conflict",
      "Unsupported file type. Supported: images (JPEG/PNG/GIF/WEBP), PDF, MP4, DOCX/XLSX/PPTX, and plain text/CSV.",
    );
  }
  if (!signature.extensions.includes(extension)) {
    throw new AppError("conflict", "This file's contents don't match its declared file extension.");
  }

  return { mimeType: OFFICE_MIME_BY_EXTENSION[extension] ?? signature.mimeType };
}
