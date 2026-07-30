import "server-only";
import { lookup } from "node:dns/promises";

/**
 * SSRF guard for admin-supplied outbound webhook URLs.
 *
 * isAllowedWebhookUrl() is the literal hostname/IP-literal check, run at
 * subscription-creation time (src/lib/services/webhooks.ts) — cheap,
 * synchronous, and catches the common case (an admin pastes an internal
 * IP or `localhost` directly).
 *
 * assertResolvesToPublicAddress() (Phase 22) additionally performs a
 * real DNS lookup and is called again at *delivery* time
 * (src/lib/jobs/webhook-handlers.ts), immediately before every fetch —
 * closing most of the practical gap the literal-IP-only check left: a
 * hostname that resolves to a private/internal address is rejected on
 * every attempt, not just once at creation time. This still isn't
 * fully DNS-rebinding-proof (a TOCTOU window remains between this
 * lookup and fetch()'s own, separate DNS resolution — full protection
 * would require pinning the validated IP for the actual connection,
 * which needs a custom fetch dispatcher/agent this codebase doesn't
 * have yet) — see docs/architecture/security-hardening.md's known
 * gaps.
 */
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0"]);

function isPrivateIPv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local
  if (a === 0) return true; // "this network"
  return false;
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") || // link-local
    normalized.startsWith("fc") || // unique local
    normalized.startsWith("fd") || // unique local
    normalized.startsWith("::ffff:127.") || // IPv4-mapped loopback
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

export function isAllowedWebhookUrl(rawUrl: string): { allowed: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "Not a valid URL." };
  }
  if (url.protocol !== "https:") {
    return { allowed: false, reason: "Webhook URLs must use https://." };
  }
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local")) {
    return { allowed: false, reason: "This host is not allowed as a webhook destination." };
  }
  if (
    hostname === "::1" ||
    hostname.startsWith("fe80:") ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd")
  ) {
    return { allowed: false, reason: "This host is not allowed as a webhook destination." };
  }
  if (isPrivateIPv4(hostname)) {
    return {
      allowed: false,
      reason: "Private/internal IP addresses are not allowed as a webhook destination.",
    };
  }
  return { allowed: true };
}

/**
 * Delivery-time check: resolves the target URL's hostname and rejects if
 * ANY resolved address (IPv4 or IPv6 — a hostname can have both) is
 * private/loopback/link-local. Call this immediately before every
 * outbound fetch, not just once at subscription creation.
 */
export async function assertResolvesToPublicAddress(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  const hostname = url.hostname;

  const literalCheck = isAllowedWebhookUrl(rawUrl);
  if (!literalCheck.allowed) {
    throw new Error(literalCheck.reason ?? "This host is not allowed as a webhook destination.");
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(`Could not resolve webhook destination host: ${hostname}`);
  }

  for (const { address, family } of addresses) {
    const isPrivate = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
    if (isPrivate) {
      throw new Error(
        `Webhook destination host resolves to a private/internal address (${address}) — delivery blocked.`,
      );
    }
  }
}
