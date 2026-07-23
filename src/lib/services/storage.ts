import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase Storage access. Per docs/architecture/file-storage.md
 * principle 1, the knowledge-documents bucket is fully private with no
 * Storage-level RLS policies at all (see the migration's header comment)
 * — every upload/download goes through this service-role client, and
 * only after the caller's own requirePermission()/
 * has_scoped_permission() check has already run in knowledge-documents.ts/
 * document-versions.ts. Never import this from a "use client" component;
 * see client-admin.ts's identical warning for the same class of key.
 */
const BUCKET = "knowledge-documents";
const SIGNED_URL_EXPIRY_SECONDS = 300;

let client: SupabaseClient | undefined;

function getStorageClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set — see docs/development/supabase-setup.md.",
      );
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/** Tenant-scoped storage path per file-storage.md principle 2 — never a shared flat namespace. */
export function buildStoragePath(
  organizationId: string,
  documentId: string,
  versionId: string,
  filename: string,
): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${organizationId}/${documentId}/${versionId}/${safeFilename}`;
}

export async function uploadFile(path: string, data: Buffer, contentType: string): Promise<void> {
  const { error } = await getStorageClient()
    .storage.from(BUCKET)
    .upload(path, data, { contentType, upsert: false });
  if (error) {
    throw new Error(`Failed to upload file to storage: ${error.message}`);
  }
}

export async function createSignedUrl(path: string): Promise<string> {
  const { data, error } = await getStorageClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error || !data) {
    throw new Error(`Failed to create a download link: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}
