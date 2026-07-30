# Customer Security Questionnaire Response Library

Draft answers to common security-questionnaire questions, sourced from
what's actually implemented (see
[security-hardening.md](../architecture/security-hardening.md) and
[threat-model.md](../architecture/threat-model.md)) — never a fabricated
"yes" to a question the product doesn't actually satisfy.

| Question                                            | Answer                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do you encrypt data in transit?                     | Yes, HTTPS/TLS for all traffic.                                                                                                                                                                                                                             |
| Do you encrypt data at rest?                        | Third-party credentials and webhook secrets are encrypted (AES-256-GCM). Database-level encryption at rest is provided by our infrastructure provider (Supabase/Postgres) — confirm current provider posture before answering for a specific customer.      |
| Do you support SSO?                                 | SAML/OIDC enterprise connections are available; not yet exercised end-to-end against a live customer identity provider in production.                                                                                                                       |
| Do you have SOC 2 / ISO 27001 certification?        | No. We do not claim any compliance certification at this time.                                                                                                                                                                                              |
| How is tenant data isolated?                        | Row-Level Security policies plus application-layer scoping on every tenant-owned table, statically verified in CI.                                                                                                                                          |
| Do you have a documented incident response process? | Yes — see [incident-response-plan.md](incident-response-plan.md). Not yet exercised against a real incident.                                                                                                                                                |
| Do you perform regular security testing?            | CodeQL static analysis and dependency/secret scanning run on every change. No third-party penetration test has been performed.                                                                                                                              |
| Can we get a signed DPA?                            | Yes, for ProcessPilot SaaS customers — see [/legal/dpa](../../src/app/legal/dpa/page.tsx). Professional-services engagements use a separate agreement — see [/legal/professional-services-terms](../../src/app/legal/professional-services-terms/page.tsx). |
| Do you scan uploads for malware?                    | Not yet — no vendor is selected. Uploads are validated by content signature and hashed.                                                                                                                                                                     |
| Where is data hosted?                               | United States (see [/legal/subprocessors](../../src/app/legal/subprocessors/page.tsx) for the current subprocessor list).                                                                                                                                   |

Update this table whenever a control's actual status changes — never
answer "yes" here ahead of the control actually being implemented.

## Related documents

- [Security hardening](../architecture/security-hardening.md)
- [Vendor and subprocessor inventory](vendor-subprocessor-inventory.md)
