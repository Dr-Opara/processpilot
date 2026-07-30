# Data Classification Framework

## Categories

| Class                                 | Examples                                                                | Handling                                                                                                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Critical secrets**                  | Database URLs, API keys, encryption keys, webhook secrets               | Environment variables only, never logged (see [security-hardening.md](../architecture/security-hardening.md)'s `redact()`), rotated on suspected compromise                                                                              |
| **Regulated/sensitive personal data** | Uploaded evidence that may contain PII, member profile data             | Private storage, RLS-scoped, signed-URL access only                                                                                                                                                                                      |
| **Organization content**              | Processes, workflows, knowledge documents, exceptions, training records | Tenant-isolated (RLS + application scoping), never cross-organization                                                                                                                                                                    |
| **Audit/compliance records**          | `audit_events`                                                          | Immutable, retained indefinitely by default (organization-configurable retention preference exists but is not yet enforced by an automatic purge — see [organization-administration.md](../architecture/organization-administration.md)) |
| **Public/marketing content**          | Marketing site pages, published legal documents                         | No restriction — intentionally public                                                                                                                                                                                                    |

## Retention

Default retention is indefinite for audit/compliance records (by design,
for immutability). Organization admins can set retention _preferences_
for audit/evidence/exception data (Phase 21/22), but no automated purge
job reads them yet — a stated gap, not a claimed feature.

## Related documents

- [Records of processing activities](records-of-processing-activities.md)
- [Vendor and subprocessor inventory](vendor-subprocessor-inventory.md)
