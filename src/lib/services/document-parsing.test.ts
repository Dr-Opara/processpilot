import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  detectUploadKind,
  extractTextFromUpload,
  mimeTypeForKind,
  validateUpload,
  MAX_UPLOAD_SIZE_BYTES,
} from "./document-parsing";

const PDF_BUFFER = Buffer.from("%PDF-1.4\nfake pdf body");
const DOCX_BUFFER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
const TEXT_BUFFER = Buffer.from("Plain text content");

describe("detectUploadKind", () => {
  it("detects a PDF by its magic bytes and matching extension", () => {
    expect(detectUploadKind(PDF_BUFFER, "policy.pdf")).toBe("pdf");
  });

  it("detects a DOCX by its zip signature and matching extension", () => {
    expect(detectUploadKind(DOCX_BUFFER, "handbook.docx")).toBe("docx");
  });

  it("accepts plain text by extension when no binary magic bytes match", () => {
    expect(detectUploadKind(TEXT_BUFFER, "notes.txt")).toBe("text");
  });

  it("rejects a PDF whose bytes don't match its claimed extension", () => {
    expect(() => detectUploadKind(PDF_BUFFER, "policy.docx")).toThrow(
      "don't match a PDF despite its name",
    );
  });

  it("rejects a DOCX (zip) whose bytes don't match its claimed extension", () => {
    expect(() => detectUploadKind(DOCX_BUFFER, "handbook.pdf")).toThrow(
      "don't match a DOCX despite its name",
    );
  });

  it("rejects an unsupported file type entirely", () => {
    expect(() => detectUploadKind(Buffer.from("MZ\x90\x00"), "app.exe")).toThrow(
      "Only PDF, DOCX, and plain text files are supported",
    );
  });
});

describe("validateUpload", () => {
  it("rejects an empty file", () => {
    expect(() => validateUpload(Buffer.alloc(0), "empty.txt")).toThrow("empty");
  });

  it("rejects a file over the 20 MB limit", () => {
    const oversized = Buffer.alloc(MAX_UPLOAD_SIZE_BYTES + 1);
    expect(() => validateUpload(oversized, "big.txt")).toThrow("20 MB");
  });

  it("accepts a valid, correctly-sized text file", () => {
    expect(validateUpload(TEXT_BUFFER, "notes.txt")).toBe("text");
  });
});

describe("mimeTypeForKind", () => {
  it("maps each upload kind to its correct MIME type", () => {
    expect(mimeTypeForKind("pdf")).toBe("application/pdf");
    expect(mimeTypeForKind("docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(mimeTypeForKind("text")).toBe("text/plain");
  });
});

describe("extractTextFromUpload", () => {
  it("decodes plain text uploads as UTF-8", async () => {
    const text = await extractTextFromUpload(Buffer.from("héllo world"), "text");
    expect(text).toBe("héllo world");
  });
});
