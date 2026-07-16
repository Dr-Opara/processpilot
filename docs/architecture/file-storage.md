# File Storage

Supabase private storage is the planned object-storage layer (see
[system overview](system-overview.md)), used primarily for:

- Uploaded source knowledge documents.
- Task evidence (photos, files, signatures — see
  [terminology](../../product/terminology.md)).
- Generated exports (e.g. audit export files).

Not implemented as of Phase 0; this document defines the constraints that
apply once it is.

## Principles

1. **Private by default.** No uploaded file is publicly accessible by
   guessable or unauthenticated URL. Access is mediated through
   short-lived, signed URLs issued only after a server-side authorization
   check equivalent to any other protected resource access (see
   [authentication and authorization](authentication-and-authorization.md)).
2. **Tenant-scoped storage paths.** Files are stored under a path/bucket
   structure keyed by `organization_id`, consistent with
   [multi-tenancy](multi-tenancy.md) — never a shared flat namespace
   relying solely on unguessable filenames for isolation.
3. **Evidence immutability.** Once evidence is attached to a `Task` or
   `Approval` as part of workflow execution, the file reference is
   immutable — a replacement upload creates a new evidence record rather
   than overwriting the original, preserving the audit trail (see
   [data ownership](data-ownership.md)).
4. **Virus/malware scanning.** Uploaded files are treated as untrusted
   input; scanning/validation is applied before a file is made available
   for download by other members (mechanism finalized during the phase
   that implements upload, not decided in Phase 0).
5. **Retention aligned with data ownership.** File retention/deletion on
   organization or member removal follows the same rules as
   [data ownership — data residency and deletion](data-ownership.md).

## Related documents

- [Multi-tenancy](multi-tenancy.md)
- [Data ownership](data-ownership.md)
- [Feature catalog — forms and evidence](../../product/feature-catalog.md)
