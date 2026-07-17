import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartTrialForm } from "./StartTrialForm";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  pushMock.mockClear();
});

describe("StartTrialForm", () => {
  it("rejects a weak password", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<StartTrialForm />);

    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(screen.getByLabelText(/work email/i), "ada@northstar.example");
    await user.type(screen.getByLabelText(/company name/i), "Northstar Property Group");
    await user.selectOptions(screen.getByLabelText(/employee count/i), "51-200");
    await user.selectOptions(screen.getByLabelText(/industry/i), "Property management");
    await user.type(screen.getByLabelText(/password/i), "weak");
    await user.click(screen.getByLabelText(/i agree to the/i));

    await user.click(screen.getByRole("button", { name: /continue to sign up/i }));

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("requires the terms checkbox to be checked", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<StartTrialForm />);

    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(screen.getByLabelText(/work email/i), "ada@northstar.example");
    await user.type(screen.getByLabelText(/company name/i), "Northstar Property Group");
    await user.selectOptions(screen.getByLabelText(/employee count/i), "51-200");
    await user.selectOptions(screen.getByLabelText(/industry/i), "Property management");
    await user.type(screen.getByLabelText(/password/i), "Str0ngPass");

    await user.click(screen.getByRole("button", { name: /continue to sign up/i }));

    expect(await screen.findByText(/you must agree to the terms/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("submits valid data and redirects into real Clerk sign-up", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<StartTrialForm />);

    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(screen.getByLabelText(/work email/i), "ada@northstar.example");
    await user.type(screen.getByLabelText(/company name/i), "Northstar Property Group");
    await user.selectOptions(screen.getByLabelText(/employee count/i), "51-200");
    await user.selectOptions(screen.getByLabelText(/industry/i), "Property management");
    await user.type(screen.getByLabelText(/password/i), "Str0ngPass");
    await user.click(screen.getByLabelText(/i agree to the/i));

    await user.click(screen.getByRole("button", { name: /continue to sign up/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/start-trial",
      expect.objectContaining({ method: "POST" }),
    );
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledWith("/app/sign-up"));
  });

  it("shows an error and does not redirect when the server rejects the submission", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<StartTrialForm />);

    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(screen.getByLabelText(/work email/i), "ada@northstar.example");
    await user.type(screen.getByLabelText(/company name/i), "Northstar Property Group");
    await user.selectOptions(screen.getByLabelText(/employee count/i), "51-200");
    await user.selectOptions(screen.getByLabelText(/industry/i), "Property management");
    await user.type(screen.getByLabelText(/password/i), "Str0ngPass");
    await user.click(screen.getByLabelText(/i agree to the/i));

    await user.click(screen.getByRole("button", { name: /continue to sign up/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
