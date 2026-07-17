import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DesignSystemPage from "@/app/design-system/page";

describe("Design system route", () => {
  it("renders the internal design system shell when enabled", () => {
    process.env.NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM = "true";
    render(<DesignSystemPage />);

    expect(screen.getByText(/processpilot design system/i)).toBeInTheDocument();
    expect(screen.getByText(/internal demonstration content/i)).toBeInTheDocument();
  });
});
