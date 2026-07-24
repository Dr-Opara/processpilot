import Image from "next/image";
import Link from "next/link";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { requireAuth } from "@/lib/auth";
import { DASHBOARD_PATH } from "@/lib/app-host";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  // Redirects to sign-in if there's no session — every route under this
  // group is gated here, server-side, before any children render.
  await requireAuth();

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
          <OrganizationSwitcher hidePersonal afterCreateOrganizationUrl={DASHBOARD_PATH} />
          <UserButton />
        </div>
      </header>
      <main className="px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
