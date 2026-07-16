import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartTrialForm } from "./StartTrialForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StartTrialForm", () => {
  it("rejects a weak password", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<StartTrialForm />);

    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(
      screen.getByLabelText(/work email/i),
      "ada@northstar.example",
    );
    await user.type(
      screen.getByLabelText(/company name/i),
      "Northstar Property Group",
    );
    await user.selectOptions(
      screen.getByLabelText(/employee count/i),
      "51-200",
    );
    await user.selectOptions(
      screen.getByLabelText(/industry/i),
      "Property management",
    );
    await user.type(screen.getByLabelText(/password/i), "weak");
    await user.click(screen.getByLabelText(/i agree to the/i));

    await user.click(screen.getByRole("button", { name: /start free trial/i }));

    expect(
      await screen.findByText(/password must be at least 8 characters/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires the terms checkbox to be checked", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<StartTrialForm />);

    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(
      screen.getByLabelText(/work email/i),
      "ada@northstar.example",
    );
    await user.type(
      screen.getByLabelText(/company name/i),
      "Northstar Property Group",
    );
    await user.selectOptions(
      screen.getByLabelText(/employee count/i),
      "51-200",
    );
    await user.selectOptions(
      screen.getByLabelText(/industry/i),
      "Property management",
    );
    await user.type(screen.getByLabelText(/password/i), "Str0ngPass");

    await user.click(screen.getByRole("button", { name: /start free trial/i }));

    expect(
      await screen.findByText(/you must agree to the terms/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits valid data and shows the development-mode result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        devMode: true,
        message:
          "Development mode: this signup was validated but no account was created.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<StartTrialForm />);

    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(
      screen.getByLabelText(/work email/i),
      "ada@northstar.example",
    );
    await user.type(
      screen.getByLabelText(/company name/i),
      "Northstar Property Group",
    );
    await user.selectOptions(
      screen.getByLabelText(/employee count/i),
      "51-200",
    );
    await user.selectOptions(
      screen.getByLabelText(/industry/i),
      "Property management",
    );
    await user.type(screen.getByLabelText(/password/i), "Str0ngPass");
    await user.click(screen.getByLabelText(/i agree to the/i));

    await user.click(screen.getByRole("button", { name: /start free trial/i }));

    expect(
      await screen.findByText(/development mode: this signup was validated/i),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/start-trial",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
