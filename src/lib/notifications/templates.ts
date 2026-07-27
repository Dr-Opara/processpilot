import "server-only";
import type { NotificationType } from "@/lib/db/database.types";

/**
 * Notification email rendering — deliberately plain string templates,
 * not a templating engine dependency, consistent with this repo's
 * "hand-roll a narrow format rather than pull in a library" posture
 * (see src/lib/services/csv.ts). `title`/`body` originate from
 * trusted server-side callers (workflow-engine.ts, escalation.ts,
 * exceptions.ts, ...), never directly from unescaped end-user HTML
 * input, but every value is still escaped before interpolation into
 * the HTML body — defense in depth, not a trust boundary this module
 * assumes it can skip.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface NotificationEmailContent {
  subject: string;
  html: string;
  text: string;
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  task_assigned: "New task assigned",
  approval_requested: "Approval requested",
  deadline_approaching: "Deadline approaching",
  deadline_breached: "Deadline missed",
  exception_assigned: "Exception assigned to you",
};

export function renderNotificationEmail(
  notificationType: NotificationType,
  title: string,
  body: string,
  appUrl: string,
): NotificationEmailContent {
  const label = NOTIFICATION_TYPE_LABELS[notificationType];
  const subject = `ProcessPilot: ${title}`;
  const text = `${label}\n\n${title}\n\n${body}\n\nOpen ProcessPilot: ${appUrl}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(label)}</p>
      <h1 style="font-size: 18px; margin: 8px 0;">${escapeHtml(title)}</h1>
      <p style="font-size: 14px; color: #374151;">${escapeHtml(body)}</p>
      <p style="margin-top: 24px;">
        <a href="${escapeHtml(appUrl)}" style="color: #1d4ed8;">Open ProcessPilot</a>
      </p>
    </div>
  `.trim();

  return { subject, html, text };
}
