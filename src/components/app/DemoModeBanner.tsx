/**
 * Rendered in the protected app shell whenever the current
 * organization is the flagged demo workspace (Phase 28,
 * `organizations.is_demo`). Server-rendered — this is a factual
 * disclosure, not a dismissible preference, so it isn't gated behind
 * client-side state the way DemoGuidedTour's step checklist is.
 */
export function DemoModeBanner() {
  return (
    <div
      role="status"
      className="border-b border-border/70 bg-cobalt/10 px-4 py-2 text-center text-sm font-medium text-cobalt sm:px-6"
    >
      You&apos;re viewing the ProcessPilot demo workspace. Content resets periodically, and no real
      email, webhook, or AI-provider calls are ever made from here.
    </div>
  );
}
