import { describe, it, expect } from "vitest";
import { APP_NAV_ITEMS, visibleNavItems } from "./app-nav";

describe("visibleNavItems", () => {
  it("always includes items with no required permission", () => {
    const visible = visibleNavItems([], []);
    const labels = visible.map((item) => item.label);
    expect(labels).toContain("Home");
    expect(labels).toContain("My Work");
  });

  it("omits an item whose required permission is not held", () => {
    const visible = visibleNavItems([], []);
    expect(visible.map((item) => item.label)).not.toContain("People");
  });

  it("includes an item whose required permission is held unscoped", () => {
    const visible = visibleNavItems(["member.manage"], []);
    expect(visible.map((item) => item.label)).toContain("People");
  });

  it("includes an item whose required permission is held only as a scoped grant", () => {
    const visible = visibleNavItems([], ["knowledge.view"]);
    expect(visible.map((item) => item.label)).toContain("Knowledge");
  });

  it("shows every item when every required permission is held", () => {
    const allPermissions = APP_NAV_ITEMS.map((item) => item.requiredPermission).filter(
      (permission): permission is string => Boolean(permission),
    );
    expect(visibleNavItems(allPermissions, [])).toHaveLength(APP_NAV_ITEMS.length);
  });
});
