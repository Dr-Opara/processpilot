# ProcessPilot Agents

Private procurement office for ProcessPilot Technologies LLC. Thirty specialist roles serve all 50 states and Washington DC, with ME as final decision maker.

The hourly ChatGPT workflow performs research, evidence checks, document preparation and authorized email. The office visualizes recorded results; it does not run AI jobs itself. Agents move independently while actual task states remain evidence-driven.

## Run and build

Node 22+; no third-party dependencies. Run `npm test` and `npm run build`. `dist/server/index.js` is a Cloudflare-compatible Worker. The existing private Sites deployment supplies authentication headers and the ACTIVITY_PRIVATE_JWK secret. No credentials or private activity belong in Git.

## Activity and notifications

The Worker authenticates each request, reads encrypted snapshots from this branch and decrypts them server-side. Browser polls every 30 seconds. Mailbox events update the separate encrypted reviews feed. ME lights up when pending reviews are present; clicking opens the review list and Gmail links. Opening an email does not approve anything. A connection failure is shown explicitly.

See OPERATIONS.md for scope, roles, approvals, schema and the exact encrypted publishing workflow. Public source may be mirrored into the existing ProcessPilot repository; production private data must stay encrypted.

## Integration boundary

Gmail/GitHub connections belong to the scheduled ChatGPT workflow, not the browser. They must be available in the active workspace; repository configuration alone does not establish a live connection. Web search, document creation, PDF review and spreadsheet tools are assigned per role. Procurement portals requiring licenses or login remain explicitly blocked until access is provided. No additional paid model API or n8n subscription is configured.

## Recovery status

The source was recovered from branch `processpilot-agents` and is tracked in draft PR #43. The original Site ID remains in `.openai/hosting.json`; the active workspace currently returns `project_not_found` for it. Do not replace that identity or claim publication until access is restored. The private feed key is not in this repository and must remain private. Gmail must be connected and its mailbox verified before enabling the separate review event automation. The hourly procurement task is enabled, but that setting alone does not verify execution or successful feed publication.
