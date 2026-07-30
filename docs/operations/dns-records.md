# DNS Records (Phase 26)

Status: **Documentation of what would need to be configured** — no
domain is registered/pointed at Vercel in this environment. Exact record
values (Vercel's IP/CNAME targets, provider verification tokens) are
issued by each provider at setup time and cannot be fabricated here.

## Apex and subdomain routing

| Record                    | Type      | Target                                                                                | Purpose                                                              |
| ------------------------- | --------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `useprocesspilot.com`     | A / ALIAS | Vercel's apex-domain target (issued when the domain is added in the Vercel dashboard) | Apex domain                                                          |
| `www.useprocesspilot.com` | CNAME     | `cname.vercel-dns.com` (Vercel's standard target)                                     | Marketing site — the canonical `NEXT_PUBLIC_SITE_URL`                |
| `app.useprocesspilot.com` | CNAME     | `cname.vercel-dns.com`                                                                | Authenticated application (see `middleware.ts`'s host-based rewrite) |

**www redirect strategy:** the apex domain (`useprocesspilot.com`)
should redirect to `www.useprocesspilot.com`, configured in Vercel's
domain settings (Vercel supports this natively without a separate
redirect rule) — `www` is the canonical form `getSiteUrl()` defaults to.

## Email (once a real sending domain is chosen)

Resend (the email adapter's one implemented provider, Phase 16) requires
domain verification via DNS before it will send from an
`@useprocesspilot.com` address:

| Record                                               | Type                               | Purpose                                                                     |
| ---------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| `resend._domainkey.useprocesspilot.com` (or similar) | TXT (DKIM)                         | Issued by Resend when the sending domain is added to a real Resend account  |
| SPF                                                  | TXT on the apex/subdomain          | Issued by Resend, authorizes their servers to send on the domain's behalf   |
| DMARC                                                | TXT (`_dmarc.useprocesspilot.com`) | Recommended alongside SPF/DKIM; not Resend-issued, configured independently |

None of these records exist yet — **no real Resend account is
configured in this environment** (`EMAIL_PROVIDER_API_KEY` unset, see
[environment-variables.md](../development/environment-variables.md)).

## Certificate/HTTPS

Vercel provisions and renews TLS certificates automatically for any
domain added to a project (via Let's Encrypt) — no separate certificate
management is required once DNS points at Vercel correctly.

## Related documents

- [Deployment architecture](../architecture/deployment-architecture.md)
- [Production configuration matrix](production-configuration-matrix.md)
