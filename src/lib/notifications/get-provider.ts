import "server-only";
import { ResendProvider } from "@/lib/notifications/providers/resend-provider";
import type { EmailProvider } from "@/lib/notifications/adapter";

let provider: EmailProvider | undefined;

/** The one place that names a concrete provider — every caller uses this, never `new ResendProvider()` directly, mirroring src/lib/ai/get-provider.ts. */
export function getEmailProvider(): EmailProvider {
  if (!provider) provider = new ResendProvider();
  return provider;
}
