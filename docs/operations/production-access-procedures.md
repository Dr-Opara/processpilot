# Production Access Procedures

Status: **Draft — no production environment exists yet.**

## Principle

Production database, hosting, and identity-provider access is granted to
the minimum number of people who need it, tracked explicitly, and
reviewed periodically — not shared broadly "for convenience."

## Access categories

| System                                       | Access mechanism                                                                                         | Who                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| GitHub repository                            | GitHub org membership/roles                                                                              | Contributors, scoped by role (see [CONTRIBUTING.md](../../CONTRIBUTING.md)) |
| Vercel production project                    | Vercel team membership                                                                                   | Deployment owners only                                                      |
| Supabase production project                  | Supabase project membership                                                                              | Database owners only                                                        |
| Clerk production instance                    | Clerk dashboard access                                                                                   | Identity/auth owners only                                                   |
| Stripe production account                    | Stripe dashboard access                                                                                  | Billing owners only                                                         |
| `SUPABASE_DB_URL` / service-role credentials | Environment-variable secret store only (Vercel env vars) — never committed, never shared over chat/email | Deployment owners only                                                      |

## Review

Access should be reviewed whenever someone's role changes and at least
annually once real staffing exists. No review has occurred (nothing to
review yet).

## Related documents

- [Ownership matrix](ownership-matrix.md)
- [Change management](change-management.md)
- [Environment variables](../development/environment-variables.md)
