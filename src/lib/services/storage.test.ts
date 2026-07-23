import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const upload = vi.fn();
const createSignedUrlMock = vi.fn();
const from = vi.fn(() => ({ upload, createSignedUrl: createSignedUrlMock }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from } })),
}));

import { buildStoragePath, createSignedUrl, uploadFile } from "./storage";

describe("storage service", () => {
  beforeEach(() => {
    upload.mockReset();
    createSignedUrlMock.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  });

  describe("buildStoragePath", () => {
    it("builds a tenant-scoped path and sanitizes unsafe filename characters", () => {
      const path = buildStoragePath("org-1", "doc-1", "ver-1", "my file (final)!.pdf");
      expect(path).toBe("org-1/doc-1/ver-1/my_file__final__.pdf");
    });
  });

  describe("uploadFile", () => {
    it("uploads to the knowledge-documents bucket without overwriting an existing object", async () => {
      upload.mockResolvedValue({ error: null });

      await uploadFile("org-1/doc-1/ver-1/file.pdf", Buffer.from("data"), "application/pdf");

      expect(from).toHaveBeenCalledWith("knowledge-documents");
      expect(upload).toHaveBeenCalledWith("org-1/doc-1/ver-1/file.pdf", expect.any(Buffer), {
        contentType: "application/pdf",
        upsert: false,
      });
    });

    it("throws a descriptive error when the upload fails", async () => {
      upload.mockResolvedValue({ error: { message: "bucket not found" } });

      await expect(uploadFile("path", Buffer.from("x"), "text/plain")).rejects.toThrow(
        "bucket not found",
      );
    });
  });

  describe("createSignedUrl", () => {
    it("returns the signed URL on success", async () => {
      createSignedUrlMock.mockResolvedValue({
        data: { signedUrl: "https://signed.example/file" },
        error: null,
      });

      const url = await createSignedUrl("org-1/doc-1/ver-1/file.pdf");

      expect(url).toBe("https://signed.example/file");
    });

    it("throws a descriptive error when signing fails", async () => {
      createSignedUrlMock.mockResolvedValue({ data: null, error: { message: "object not found" } });

      await expect(createSignedUrl("missing/path")).rejects.toThrow("object not found");
    });
  });
});
