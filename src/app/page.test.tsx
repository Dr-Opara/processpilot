import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home", () => {
  it("renders the marketing header and hero heading", () => {
    render(<Home />);
    expect(screen.getByRole("banner").querySelector("img[alt='ProcessPilot']")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /turn company procedures into work people can actually complete/i,
        level: 1,
      }),
    ).toBeInTheDocument();
  });
});
