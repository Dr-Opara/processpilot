import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FaqAccordion } from "./FaqAccordion";

const items = [
  { question: "First question?", answer: "First answer." },
  { question: "Second question?", answer: "Second answer." },
];

describe("FaqAccordion", () => {
  it("opens the first item by default and toggles others on click", async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={items} />);

    const firstButton = screen.getByRole("button", { name: "First question?" });
    const secondButton = screen.getByRole("button", {
      name: "Second question?",
    });

    expect(firstButton).toHaveAttribute("aria-expanded", "true");
    expect(secondButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Second answer.")).not.toBeVisible();

    await user.click(secondButton);

    expect(secondButton).toHaveAttribute("aria-expanded", "true");
    expect(firstButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Second answer.")).toBeVisible();
  });
});
