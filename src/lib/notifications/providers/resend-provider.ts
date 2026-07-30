import "server-only";
import { getEmailFromAddress, getEmailProviderApiKey } from "@/lib/notifications/availability";
import type { EmailMessage, EmailProvider, EmailSendResult } from "@/lib/notifications/adapter";
import { externalRequestSignal } from "@/lib/observability/timeouts";

/**
 * The initial concrete EmailProvider — calls Resend's HTTP API
 * (https://resend.com/docs/api-reference/emails/send-email) directly
 * via fetch rather than adding the `resend` SDK as a dependency: it's a
 * single JSON POST endpoint, so a hand-rolled call keeps this on the
 * same "no new dependency for a narrow, simple integration" footing as
 * src/lib/services/csv.ts. Never called with an unconfigured key —
 * every caller checks isEmailConfigured() first (see availability.ts).
 */
const RESEND_API_URL = "https://api.resend.com/emails";

export class ResendProvider implements EmailProvider {
  readonly name = "resend";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getEmailProviderApiKey()}`,
        "Content-Type": "application/json",
      },
      signal: externalRequestSignal(),
      body: JSON.stringify({
        from: getEmailFromAddress(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Resend send failed (${response.status}): ${body.slice(0, 500)}`);
    }

    const result = (await response.json()) as { id: string };
    return { providerMessageId: result.id };
  }
}
