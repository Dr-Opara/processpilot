# ProcessPilot Agents

Private procurement office for ProcessPilot Technologies LLC. Thirty specialist roles serve all 50 states and Washington DC, with ME as final decision maker.

The hourly ChatGPT workflow performs research, evidence checks, document preparation and authorized email. The office visualizes recorded results; it does not run AI jobs itself. Agents move independently while actual task states remain evidence-driven.

## Run and build

Node 22+; no third-party dependencies. Run `npm test` and `npm run build`. `dist/server/index.js` is a Cloudflare-compatible Worker. The existing private Sites deployment supplies authentication headers and the ACTIVITY_PRIVATE_JWK secret. No credentials or private activity belong in Git.

## Activity and notifications

The Worker authenticates each request, reads encrypted snapshots from this branch and decrypts them server-side. Browser polls every 30 seconds. Mailbox events update the separate encrypted reviews feed. ME lights up when pending reviews are present; clicking opens the review list and Gmail links. Opening an email does not approve anything. A connection failure is shown explicitly.

See OPERATIONS.md for scope, roles, approvals, schema and the exact encrypted publishing workflow. Public source may be mirrored into the existing ProcessPilot repository; production private data must stay encrypted.

## Integration boundary

Gmail/GitHub are connected to the scheduled ChatGPT workflow, not exposed as browser credentials. Web search, document creation, PDF review and spreadsheet tools are assigned per role. Procurement portals requiring licenses or login remain explicitly blocked until access is provided. No additional paid model API or n8n subscription is configured.
