import "server-only";

/**
 * Best-effort SSRF guard for admin-supplied outbound webhook URLs —
 * literal hostname/IP-literal checks against loopback, link-local, and
 * private ranges. Not DNS-rebinding-proof (a hostname could resolve
 * to a private address after this check passes at request time, then
 * change by delivery time) — see
 * docs/architecture/integration-architecture.md's known gaps for what
 * a hardened version would add (resolve-then-pin the IP at delivery
 * time, block on every retry, not just at subscription-creation time).
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
  return false;
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
