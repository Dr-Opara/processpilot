# Clerk↔Supabase Identity Sync

How Clerk identity (Phase 3) and ProcessPilot's own Supabase schema
(Phase 4) stay in sync, and how a request's tenant/permission context
reaches PostgreSQL Row-Level Security. See
[authentication-and-authorization.md](authentication-and-authorization.md)
for the broader auth model and [multi-tenancy.md](multi-tenancy.md) for
the isolation guarantees this makes possible.

## Why not native Supabase Third-Party Auth (Clerk JWT → `auth.jwt()`)?

Supabase supports registering Clerk as a "Third-Party Auth" provider,
where the browser (or server) presents a real, Clerk-signed JWT and
Postgres verifies it directly. This was considered and deliberately not
used yet: it requires Clerk JWT-template configuration and a Supabase
dashboard integration step beyond just provisioning a project, and steers
the query layer toward Supabase's PostgREST/`supabase-js` query builder
over raw SQL. ProcessPilot has no browser-side Supabase client at all as
of Phase 4 — every database access is server-only — so there is no
present need for a real signed JWT to reach Postgres. **Revisit this if a
genuine browser-side Supabase client is ever needed** (e.g. Realtime, or
Storage in Phase 6 using `supabase-js` directly from the browser); the RLS
policies already use the same `auth.jwt()`-style convention
(`request.jwt.claims`), so switching later doesn't require rewriting
policy SQL — only how the claims GUC gets populated.

## The model actually used: server-set session claims

1. A request arrives at a protected route/action. `requireAuth()`
   (`src/lib/auth.ts`, Phase 3, unchanged) verifies the Clerk session
   server-side.
2. `src/lib/authz.ts`'s `getCurrentMembership()` resolves the caller's
   ProcessPilot `profiles`/`organizations`/`organization_members` rows by
   the verified `clerk_user_id`/`clerk_org_id` — using the admin
   (service-role) client, since no tenant context can exist yet at this
   bootstrapping step. It also resolves the caller's _unscoped_
   permissions (`resolveUnscopedPermissions()`).
3. `src/lib/db/tenant-context.ts`'s `withTenantContext()` opens a
   transaction, runs `select set_config('request.jwt.claims', '<json>',
true)` (`SET LOCAL` semantics — scoped to the transaction, safe under
   Supabase's transaction-mode connection pooling), then `set local role
authenticated` — the same low-privilege Postgres role Supabase's own
   PostgREST/RLS tooling uses, just reached by an explicit role switch
   instead of PostgREST's own auth flow.
4. Every RLS policy in `supabase/migrations/` reads that GUC through SQL
   helper functions (`current_org_id()`, `current_member_id()`,
   `has_permission(text)`) defined once, in the first migration.

```mermaid
sequenceDiagram
    participant Browser
    participant Route as Route/Action
    participant Auth as requireAuth() (Clerk)
    participant Authz as getCurrentMembership()
    participant TenantCtx as withTenantContext()
    participant PG as Postgres (RLS)

    Browser->>Route: request
    Route->>Auth: verify session
    Auth-->>Route: clerk_user_id, clerk_org_id
    Route->>Authz: resolve profile/org/member/permissions
    Authz->>PG: admin client (self-scoped lookup only)
    Authz-->>Route: CurrentMembership
    Route->>TenantCtx: withTenantContext(context, fn)
    TenantCtx->>PG: BEGIN; SET LOCAL request.jwt.claims; SET LOCAL ROLE authenticated
    TenantCtx->>PG: fn(tx) — ordinary tenant-scoped queries, RLS-enforced
    PG-->>TenantCtx: rows (already org-scoped)
    TenantCtx->>PG: COMMIT
```

There is exactly one place in the codebase that constructs this claims
object and exactly one place that can obtain an authenticated-role
connection at all (`withTenantContext` itself is not exported alongside a
raw connection getter) — see
[database-schema.md](database-schema.md#rlssession-context-model).

## Webhook-driven sync (`/api/webhooks/clerk`)

Clerk webhook requests carry no user session — they're authenticated by
Standard Webhooks signature (`verifyWebhook`, unchanged from Phase 3).
`src/lib/db/identity-sync.ts` maps the verified payload onto
`profiles`/`organizations`/`organization_members` using the admin
(service-role) client — there is no tenant context to construct yet for
an event that might be _creating_ the organization in question.

| Clerk event                                                        | Effect                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `user.created`, `user.updated`                                     | Upsert `profiles` by `clerk_user_id`.                                                                                      |
| `user.deleted`                                                     | Set `profiles.deleted_at` — never a hard delete (preserves authorship references).                                         |
| `organization.created`, `organization.updated`                     | Upsert `organizations` by `clerk_org_id`; create `organization_settings` on first sync.                                    |
| `organization.deleted`                                             | Set `organizations.archived_at` — a soft archive, not a cascading hard delete, per [data-ownership.md](data-ownership.md). |
| `organizationMembership.created`, `organizationMembership.updated` | Upsert `organization_members` by `clerk_membership_id`, status `active`.                                                   |
| `organizationMembership.deleted`                                   | Set the matching `organization_members.status = 'removed'`.                                                                |

Every handler writes an `audit_events` row (`source: 'webhook'`,
`correlation_id`: the Clerk delivery's `svix-id`) inside the same
transaction as its data change.

### Idempotency

`svix-id` (the Standard Webhooks delivery id) is the dedupe key — never a
resource id from the payload, since the same resource id recurs across
multiple distinct events (e.g. a user's `created` then `updated`).
`webhook_events` records it _before_ any sync logic runs, guarded by a
partial unique index on `(clerk_event_id) where status = 'processed'` —
see that migration's comment for why a plain column-level unique
constraint would incorrectly block a legitimate retry after a prior failed
attempt. A concurrent duplicate delivery loses the race on that insert and
is acknowledged as already-processed without re-running any sync logic.
Every `syncXUpserted`/`syncXRemoved` function in `identity-sync.ts` is also
independently idempotent (`ON CONFLICT` upsert on the relevant Clerk id),
so replaying the same event twice converges to the same end state even if
the outer dedupe guard were somehow bypassed.

## Related documents

- [Authentication and authorization](authentication-and-authorization.md)
- [Multi-tenancy](multi-tenancy.md)
- [Database schema](database-schema.md)
- [ADR-0003: Clerk for identity and organization membership](decisions/0003-clerk-identity.md)
