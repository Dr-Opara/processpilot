import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase Storage access for the private `evidence`
 * bucket — same posture as storage.ts's knowledge-documents bucket (no
 * Storage-level RLS at all; every read/write goes through this
 * service-role client, only after evidence.ts's own
 * requirePermission()/has_scoped_permission() check has already run).
 * A separate bucket from knowledge-documents keeps the two content
 * types' retention/lifecycle rules independently configurable later,
 * even though the access pattern is identical today.
 */
const BUCKET = "evidence";
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
export function buildEvidenceStoragePath(
  organizationId: string,
  evidenceId: string,
  filename: string,
): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${organizationId}/${evidenceId}/${safeFilename}`;
}

export async function uploadEvidenceFile(
  path: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await getStorageClient()
    .storage.from(BUCKET)
    .upload(path, data, { contentType, upsert: false });
  if (error) {
    throw new Error(`Failed to upload file to storage: ${error.message}`);
  }
}

export async function createEvidenceSignedUrl(path: string): Promise<string> {
  const { data, error } = await getStorageClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error || !data) {
    throw new Error(`Failed to create a download link: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}
