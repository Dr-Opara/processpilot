import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestDemoForm } from "./RequestDemoForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RequestDemoForm", () => {
  it("shows validation errors when submitted empty and does not call the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<RequestDemoForm />);
    await user.click(screen.getByRole("button", { name: /request a demo/i }));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits valid data and shows the development-mode result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        devMode: true,
        message: "Development mode: this request was validated but not saved.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<RequestDemoForm />);

    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(
      screen.getByLabelText(/work email/i),
      "ada@northstar.example",
    );
    await user.type(
      screen.getByLabelText(/^company$/i),
      "Northstar Property Group",
    );
    await user.type(screen.getByLabelText(/job title/i), "Operations Director");
    await user.selectOptions(
      screen.getByLabelText(/employee count/i),
      "51-200",
    );
    await user.selectOptions(
      screen.getByLabelText(/primary use case/i),
      "Standardizing operations across locations",
    );

    await user.click(screen.getByRole("button", { name: /request a demo/i }));

    expect(
      await screen.findByText(/development mode: this request was validated/i),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/request-demo",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
