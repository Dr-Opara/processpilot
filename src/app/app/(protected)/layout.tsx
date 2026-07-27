import Image from "next/image";
import Link from "next/link";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { requireAuth } from "@/lib/auth";
import { DASHBOARD_PATH } from "@/lib/app-host";
import { getUnreadNotificationCount } from "@/lib/services/notifications";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  // Redirects to sign-in if there's no session — every route under this
  // group is gated here, server-side, before any children render.
  await requireAuth();

  // Best-effort — a member with no organization yet (e.g. mid-onboarding)
  // has nothing to count, and the bell degrades to 0 rather than
  // breaking every protected page's layout.
  const unreadCount = await getUnreadNotificationCount().catch(() => 0);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-border/70 bg-surface px-4 py-3 sm:px-6">
        <Link href={DASHBOARD_PATH} aria-label="ProcessPilot">
          <Image
            src="/brand/branding/processpilot-icon.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7"
          />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={{ pathname: "/app/notifications" }}
            className="relative flex items-center gap-1 text-sm font-medium text-ink"
            aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          >
            Notifications
            {unreadCount > 0 && (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-cobalt px-1.5 py-0.5 text-xs font-semibold text-surface">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
          <OrganizationSwitcher hidePersonal afterCreateOrganizationUrl={DASHBOARD_PATH} />
          <UserButton />
        </div>
      </header>
      <main className="px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
