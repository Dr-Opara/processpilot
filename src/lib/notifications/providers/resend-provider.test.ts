import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { ResendProvider } from "./resend-provider";

const ORIGINAL_KEY = process.env.EMAIL_PROVIDER_API_KEY;
const ORIGINAL_FROM = process.env.EMAIL_FROM_ADDRESS;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.EMAIL_PROVIDER_API_KEY;
  else process.env.EMAIL_PROVIDER_API_KEY = ORIGINAL_KEY;
  if (ORIGINAL_FROM === undefined) delete process.env.EMAIL_FROM_ADDRESS;
  else process.env.EMAIL_FROM_ADDRESS = ORIGINAL_FROM;
  vi.unstubAllGlobals();
});

describe("ResendProvider", () => {
  it("posts to Resend's API and returns the provider message id on success", async () => {
    process.env.EMAIL_PROVIDER_API_KEY = "re_real_looking_value";
    process.env.EMAIL_FROM_ADDRESS = "no-reply@example.com";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "resend-msg-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ResendProvider().send({
      to: "member@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(result.providerMessageId).toBe("resend-msg-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_real_looking_value" }),
      }),
    );
  });

  it("throws with the response body on a non-2xx response", async () => {
    process.env.EMAIL_PROVIDER_API_KEY = "re_real_looking_value";
    process.env.EMAIL_FROM_ADDRESS = "no-reply@example.com";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => "invalid recipient",
      }),
    );

    await expect(
      new ResendProvider().send({ to: "bad", subject: "Hi", html: "<p>Hi</p>", text: "Hi" }),
    ).rejects.toThrow(/422/);
  });

  it("throws when the environment isn't configured, without calling fetch", async () => {
    delete process.env.EMAIL_PROVIDER_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new ResendProvider().send({
        to: "member@example.com",
        subject: "Hi",
        html: "<p>Hi</p>",
        text: "Hi",
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
