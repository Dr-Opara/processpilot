import type { Route } from "next";

/**
 * Primary navigation catalog (Phase 20) — see
 * design/application-layout.md and product/information-architecture.md.
 * Purely a rendering concern: hiding an item here never substitutes for
 * the server-side requirePermission() check the target route's own
 * service layer performs.
 */
export interface AppNavItem {
  label: string;
  href: Route;
  /** Omit for an item every active member sees regardless of permissions (Home, My Work). */
  requiredPermission?: string;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { label: "Home", href: "/app" },
  { label: "My Work", href: "/app/tasks" },
  { label: "Processes", href: "/app/processes", requiredPermission: "process.view" },
  { label: "Workflows", href: "/app/workflows", requiredPermission: "process.view" },
  { label: "Knowledge", href: "/app/knowledge", requiredPermission: "knowledge.view" },
  { label: "Training", href: "/app/training", requiredPermission: "training.view" },
  { label: "Exceptions", href: "/app/exceptions", requiredPermission: "exceptions.view" },
  { label: "Analytics", href: "/app/analytics", requiredPermission: "analytics.view" },
  { label: "Audit", href: "/app/audit", requiredPermission: "audit.view" },
  { label: "Integrations", href: "/app/integrations", requiredPermission: "integration.manage" },
  { label: "People", href: "/app/members", requiredPermission: "member.manage" },
  { label: "Roles", href: "/app/roles", requiredPermission: "role.manage" },
  { label: "Billing", href: "/app/billing", requiredPermission: "billing.manage" },
];

export function visibleNavItems(permissions: string[], scopedPermissions: string[]): AppNavItem[] {
  const held = new Set([...permissions, ...scopedPermissions]);
  return APP_NAV_ITEMS.filter(
    (item) => !item.requiredPermission || held.has(item.requiredPermission),
  );
}
