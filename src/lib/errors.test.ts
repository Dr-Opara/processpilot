import { describe, expect, it, vi } from "vitest";
import { AppError, toSafeErrorResponse } from "./errors";

describe("toSafeErrorResponse", () => {
  it("maps each AppError code to its HTTP status and passes the message through", () => {
    expect(toSafeErrorResponse(new AppError("unauthorized", "no session"))).toEqual({
      status: 401,
      body: { error: "no session" },
    });
    expect(toSafeErrorResponse(new AppError("forbidden", "missing permission"))).toEqual({
      status: 403,
      body: { error: "missing permission" },
    });
    expect(toSafeErrorResponse(new AppError("not_found", "no such org"))).toEqual({
      status: 404,
      body: { error: "no such org" },
    });
    expect(toSafeErrorResponse(new AppError("conflict", "already exists"))).toEqual({
      status: 409,
      body: { error: "already exists" },
    });
  });

  it("never leaks a raw driver/unknown error message to the caller", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = toSafeErrorResponse(
      new Error('duplicate key value violates unique constraint "profiles_clerk_user_id_key"'),
    );

    expect(result.status).toBe(500);
    expect(result.body.error).toBe("Something went wrong. Please try again.");
    expect(result.body.error).not.toContain("constraint");
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it("handles a thrown non-Error value the same way", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = toSafeErrorResponse("a thrown string, not an Error");

    expect(result.status).toBe(500);
    expect(result.body.error).toBe("Something went wrong. Please try again.");

    spy.mockRestore();
  });
});
