import "server-only";

/**
 * Provider-neutral email adapter, mirroring src/lib/ai/adapter.ts's
 * pattern for the AI provider (see ADR-0008 for the rationale this
 * extends to the "Email" adapter integration-architecture.md names).
 * Every notification send goes through `getEmailProvider().send()` —
 * never a vendor SDK/API called directly from a service or job
 * handler — so swapping providers later touches only providers/*.ts.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  providerMessageId: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
