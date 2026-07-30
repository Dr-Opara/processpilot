import Image from "next/image";
import Link from "next/link";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { requireAuth } from "@/lib/auth";
import { DASHBOARD_PATH } from "@/lib/app-host";
import { getCurrentMembership } from "@/lib/authz";
import { getUnreadNotificationCount } from "@/lib/services/notifications";
import { visibleNavItems } from "@/lib/app-nav";
import { AppNav } from "@/components/app/AppNav";
import { AppPwaClient } from "@/components/app/AppPwaClient";
import { DemoModeBanner } from "@/components/app/DemoModeBanner";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  // Redirects to sign-in if there's no session — every route under this
  // group is gated here, server-side, before any children render.
  await requireAuth();

  // Both best-effort — a member with no organization yet (e.g.
  // mid-onboarding) has nothing to count/navigate, and the shell degrades
  // gracefully (no nav, unread count 0) rather than breaking every
  // protected page's layout.
  const [unreadCount, membership] = await Promise.all([
    getUnreadNotificationCount().catch(() => 0),
    getCurrentMembership().catch(() => null),
  ]);

  // external_user sessions render a minimal, resource-specific shell —
  // no primary navigation — per design/application-layout.md.
  const isExternalUser = membership?.roleKeys.includes("external_user") ?? false;
  const navItems =
    membership && !isExternalUser
      ? visibleNavItems(membership.permissions, membership.scopedPermissions)
      : [];

  const isDemoWorkspace = membership?.organization.is_demo ?? false;

  return (
    <div className="min-h-screen bg-paper text-ink">
      {isDemoWorkspace && <DemoModeBanner />}
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
      <AppPwaClient />
      <div className="flex flex-col md:flex-row">
        {navItems.length > 0 && <AppNav items={navItems} />}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
