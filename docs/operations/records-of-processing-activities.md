# Records of Processing Activities (ROPA)

A GDPR Article 30-style record of what personal data ProcessPilot
processes, for what purpose, and on what legal basis. Written from the
actual, implemented data model — not aspirational.

| Processing activity                 | Data categories                                       | Purpose                                                   | Legal basis (typical)            | Retention                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account creation and authentication | Name, email, credentials (held by Clerk)              | Provide the service                                       | Contract                         | Duration of account + deletion grace period                                                                                                       |
| Organization membership             | Role, department, job title, manager                  | Access control, org-chart features                        | Contract                         | Duration of membership                                                                                                                            |
| Workflow/task execution             | Task assignments, completions, approvals              | Deliver the core product                                  | Contract                         | Indefinite (audit)                                                                                                                                |
| Evidence/document upload            | File contents, uploader identity                      | Compliance record-keeping for the customer's own use case | Contract                         | Per organization's configured retention preference                                                                                                |
| Audit logging                       | Actor, action, resource, timestamp                    | Security, compliance, dispute resolution                  | Legitimate interest              | Indefinite (immutable)                                                                                                                            |
| Billing                             | Billing contact, subscription/plan                    | Payment processing                                        | Contract                         | Duration of subscription + statutory retention                                                                                                    |
| Notification delivery               | Email address, notification content                   | Operational communication                                 | Contract                         | Delivery-log retention (not separately time-boxed today)                                                                                          |
| AI-assisted features (when enabled) | Organization content submitted for grounding/drafting | Deliver AI features                                       | Contract / consent (org opts in) | Not persisted beyond the request/response cycle by the AI provider integration itself; `ai_usage_events` retains usage metadata, not full content |

This table should be reviewed and expanded by counsel before being relied
upon for a real regulatory filing.

## Related documents

- [Data classification framework](data-classification.md)
- [Privacy Policy](../../src/app/privacy/page.tsx)
