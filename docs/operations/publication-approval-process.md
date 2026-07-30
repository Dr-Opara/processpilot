# Client Confidentiality and Publication-Approval Process

Implements the publication/name/logo-use terms in
[/legal/professional-services-terms](../../src/app/legal/professional-services-terms/page.tsx).
Applies to any public content referencing a professional-services client
or independent-contract-engagement organization by name, logo, or
identifiable description — including an anonymized description specific
enough to identify the client.

## Default state

Every named-client reference defaults to **unpublished / approval
required**. This is enforced by content structure, not just policy —
Phase 31A's engagement content model defaults `publicationStatus` to
`"Client Approval Required"` and the corresponding page route returns
"not found" for any status short of `"Published"` unless a specific
approved anonymized variant exists.

## Approval steps

1. Draft the engagement content (summary, services, frameworks — never
   outcomes/metrics/contract terms unless the client explicitly
   confirmed and approved including them).
2. Internal review: confirm nothing confidential, proprietary, or
   client-sensitive is included (see the confidentiality carve-outs in
   each engagement's own content requirements).
3. Send the drafted content to the client's designated approver for
   written sign-off — specifically covering (a) the engagement
   description text, and (b) logo/trademark use, which requires
   separate approval from text-content approval.
4. Record the approval: approver name/role, date, and what was approved
   (which exact version of the content) — this is the `approvalDate`/
   `approvedBy` field in the engagement content model.
5. Only after recorded approval does `publicationStatus` move to
   `"Approved for Publication"`, and only a deliberate second action
   (not automatic) moves it to `"Published"`.

## Anonymized alternative

If a client won't approve named publication, an anonymized version
(e.g. "Independent U.S. Federal Regulatory Agency") can be published
without that client's specific approval, provided the anonymized
description itself contains nothing that would let a reader identify the
client with confidence — reviewed the same way as named content, minus
the client-approval step.

## Related documents

- [Professional Services Terms](../../src/app/legal/professional-services-terms/page.tsx)
- [Ownership matrix](ownership-matrix.md)
