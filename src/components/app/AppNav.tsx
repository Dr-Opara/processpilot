import Link from "next/link";
import type { AppNavItem } from "@/lib/app-nav";

const linkClassName =
  "block rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt";

function NavLinks({ items }: { items: AppNavItem[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className={linkClassName}>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Role-aware primary navigation (Phase 20) — see
 * design/application-layout.md. `items` is already filtered to what the
 * current member can see (src/lib/app-nav.ts's visibleNavItems()); this
 * component is presentation only.
 *
 * Desktop: a persistent sidebar (md breakpoint and up). Mobile: a
 * `<details>`-based disclosure in the header, so no client-side
 * JavaScript is needed to open/close it.
 */
export function AppNav({ items }: { items: AppNavItem[] }) {
  return (
    <>
      <nav
        aria-label="Primary"
        className="hidden w-56 shrink-0 border-r border-border/70 bg-surface p-4 md:block"
      >
        <NavLinks items={items} />
      </nav>
      <details className="border-b border-border/70 bg-surface md:hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink">
          Menu
        </summary>
        <nav aria-label="Primary" className="px-4 pb-3">
          <NavLinks items={items} />
        </nav>
      </details>
    </>
  );
}
