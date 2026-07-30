"use client";

import { useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "processpilot.demo-tour.dismissed";

const STEPS: { label: string; href: "/app/processes" | "/app/knowledge" | "/app/analytics" }[] = [
  { label: 'Open the seeded "Customer Onboarding (Demo)" process', href: "/app/processes" },
  { label: "Browse the seeded knowledge document", href: "/app/knowledge" },
  { label: "Check the analytics dashboard", href: "/app/analytics" },
];

/**
 * A small, dismissible checklist pointing a prospect at the demo
 * workspace's seeded content (Phase 28). Dismissal is local-only
 * (localStorage) — there is no server-side "tour completed" state,
 * deliberately: this is a walkthrough aid, not data worth persisting
 * or syncing across devices.
 */
export function DemoGuidedTour() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });

  if (dismissed) return null;

  return (
    <div className="mb-6 rounded-md border border-border/70 bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Try the demo workspace</p>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(STORAGE_KEY, "true");
            setDismissed(true);
          }}
          className="text-xs text-muted underline"
        >
          Dismiss
        </button>
      </div>
      <ul className="list-inside list-disc space-y-1 text-sm text-muted">
        {STEPS.map((step) => (
          <li key={step.href}>
            <Link href={step.href} className="text-cobalt underline">
              {step.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
