import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RoleTabs } from "./RoleTabs";

describe("RoleTabs", () => {
  it("shows the Employee panel by default and switches on tab click", async () => {
    const user = userEvent.setup();
    render(<RoleTabs />);

    const employeeTab = screen.getByRole("tab", { name: "Employee" });
    const managerTab = screen.getByRole("tab", { name: "Manager" });

    expect(employeeTab).toHaveAttribute("aria-selected", "true");
    expect(managerTab).toHaveAttribute("aria-selected", "false");

    await user.click(managerTab);

    expect(managerTab).toHaveAttribute("aria-selected", "true");
    expect(employeeTab).toHaveAttribute("aria-selected", "false");

    const managerPanel = screen.getByRole("tabpanel", { name: "Manager" });
    expect(managerPanel).not.toHaveAttribute("hidden");
  });

  it("moves focus between tabs with arrow keys", async () => {
    const user = userEvent.setup();
    render(<RoleTabs />);

    const employeeTab = screen.getByRole("tab", { name: "Employee" });
    employeeTab.focus();

    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Manager" })).toHaveFocus();
  });
});
