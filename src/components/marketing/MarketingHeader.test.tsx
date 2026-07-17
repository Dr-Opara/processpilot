import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MarketingHeader } from "./MarketingHeader";

describe("MarketingHeader", () => {
  it("shows primary CTAs and top-level nav on desktop", () => {
    render(<MarketingHeader />);

    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request demo/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start free trial/i })).toBeInTheDocument();

    const primaryNav = screen.getByRole("navigation", { name: /primary/i });
    expect(within(primaryNav).getByText("Product")).toBeInTheDocument();
    expect(within(primaryNav).getByText("Resources")).toBeInTheDocument();
    expect(within(primaryNav).getByText("Pricing")).toBeInTheDocument();
  });

  it("opens a product dropdown with sub-links on click", async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    const trigger = screen.getByRole("button", { name: /product/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /knowledge/i })).toBeInTheDocument();
  });

  it("toggles the mobile menu open and closed", async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    const toggle = screen.getByRole("button", { name: /open menu/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /close menu/i })).toBeInTheDocument();
  });
});
