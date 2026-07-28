/**
 * Normalized, safe-to-return error shape for every server-side
 * authorization/data-access failure. Route handlers and server actions
 * catch unknown errors and pass them through toSafeErrorResponse() rather
 * than ever forwarding a raw driver/database error message to a client —
 * see docs/architecture/authentication-and-authorization.md.
 */
export type AppErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "unavailable"
  | "bad_request"
  | "rate_limited";

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

function toHttpStatus(code: AppErrorCode): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "unavailable":
      return 503;
    case "bad_request":
      return 400;
    case "rate_limited":
      return 429;
  }
}

export interface SafeErrorResponse {
  status: number;
  body: { error: string };
}

/**
 * AppError messages are already written to be user-safe (they never
 * include raw SQL, connection strings, or stack traces), so they pass
 * through as-is. Anything else — a driver error, a thrown string, an
 * unexpected exception — is logged server-side and replaced with a
 * generic message, since its content is not guaranteed to be safe to
 * show a caller.
 */
export function toSafeErrorResponse(error: unknown): SafeErrorResponse {
  if (error instanceof AppError) {
    return { status: toHttpStatus(error.code), body: { error: error.message } };
  }

  console.error("Unhandled server error", error);
  return { status: 500, body: { error: "Something went wrong. Please try again." } };
}
