# Cloud Development Model

ProcessPilot is developed entirely through GitHub Codespaces. No step in the
normal workflow requires Node.js, Docker, a database, a build, a test run,
or an application server on a developer's personal computer.

## Why

- **Consistency.** Every contributor gets the same environment, defined once
  in [.devcontainer/devcontainer.json](../../.devcontainer/devcontainer.json),
  instead of drifting local setups.
- **Zero local setup.** A browser and a GitHub account are enough to start
  contributing.
- **Safety.** Secrets never need to touch a personal machine — they live in
  Codespaces secrets, GitHub Actions secrets, Vercel, or provider
  dashboards. See [environment-variables.md](environment-variables.md).
- **Disposability.** A broken environment is deleted and recreated in
  minutes, not debugged for hours.

## The stack

| Concern                 | Tool                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Source control          | GitHub                                                                                              |
| Development environment | GitHub Codespaces                                                                                   |
| Editor                  | Browser-based VS Code (or the desktop app connected to a Codespace)                                 |
| AI pair programming     | Claude Code, installed and run inside the Codespace                                                 |
| Continuous integration  | GitHub Actions                                                                                      |
| Deployment              | Vercel (Git-connected: preview per branch/PR, production from `main`)                               |
| Managed services        | Cloud providers for auth, database, storage, billing, queues, email, AI — never self-hosted locally |

## Starting a Codespace

1. On GitHub, go to the repository, click **Code > Codespaces > Create
   codespace on main** (or on your feature branch).
2. Wait for the container to build and `postCreateCommand` to finish
   (installs npm dependencies).
3. VS Code opens in the browser (or launch the desktop app and connect to
   the Codespace).
4. Run `npm run dev` and open the forwarded port-3000 URL — Codespaces will
   prompt with a notification, or use the **Ports** tab.

## Daily workflow

```bash
npm run dev          # start the Next.js dev server (port 3000, forwarded)
npm run format       # apply Prettier formatting
npm run lint         # run ESLint
npm run typecheck    # run the TypeScript compiler in check-only mode
npm run test         # run unit tests (Vitest)
npm run test:e2e     # run browser tests (Playwright) — see below
npm run build        # production build
npm run env:check    # verify required environment variables are set
npm run git:status   # summarize branch/tracking/working-tree state
npm run phase:commit # run the full validation suite before committing
```

All of these run inside the Codespace (or in GitHub Actions on push/PR) —
never on a local machine.

### Browser testing

Playwright browsers are not bundled by default. Install them once per
Codespace (already wired into `postCreateCommand`, but can be re-run
manually):

```bash
npm run test:e2e:install
```

`playwright.config.ts` targets the Codespaces-forwarded URL automatically
when `CODESPACE_NAME` is set, so `npm run test:e2e` exercises the same
origin a human reviewer would see in the browser rather than hard-coded
`localhost`.

## Ports

Port `3000` (Next.js dev server) is forwarded automatically and is
**private by default** — only you can open it, and it requires your GitHub
authentication. Make a port public only for a specific, temporary reason
(e.g. demoing to someone without repo access), and set it back to private
afterward. See
[.devcontainer/devcontainer.json](../../.devcontainer/devcontainer.json).

## Vercel deployment

### Connecting the repository (one-time, manual)

Vercel deployment is Git-connected, not triggered by CI. To wire it up:

1. Go to [vercel.com](https://vercel.com) and sign in with the GitHub
   account that owns this repository (or an org with access).
2. **Add New... > Project**, then select `Dr-Opara/processpilot` from the
   GitHub repository list (authorize the Vercel GitHub App if prompted).
3. Framework preset should auto-detect as **Next.js** — leave build/output
   settings at their defaults unless a later phase changes them.
4. Under **Environment Variables**, add each variable from
   [environment-variables.md](environment-variables.md) that's required for
   the current phase, scoped to the right environment (Production /
   Preview / Development). Do not add production secrets until they're
   actually needed — see [SECURITY.md](../../SECURITY.md).
5. Set **Production Branch** to `main` under **Settings > Git**.
6. Click **Deploy**. Every subsequent push to `main` and every pull request
   will now deploy automatically.

### Behavior by environment

| Environment        | Trigger                                                                                                                                              | Branch    | Variables                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------- |
| Production         | Push/merge to `main`                                                                                                                                 | `main`    | Production environment variables                         |
| Preview            | Every pull request and every push to a non-production branch (including `develop` and `feature/*`)                                                   | any       | Preview environment variables (separate from production) |
| Staging (optional) | A dedicated long-lived branch (e.g. `staging`) can be assigned its own Vercel environment if the project later needs a persistent pre-production URL | `staging` | Its own scoped variables                                 |

Preview and production environment variables are configured separately in
Vercel and must never share values that are meant to stay production-only
(e.g. live billing keys). Use test-mode credentials for Preview.

Every pull request gets its own preview deployment once the GitHub
repository is connected to a Vercel project. Use the preview URL — not a
locally run server — to visually review UI changes. Once connected,
[.github/workflows/preview-checks.yml](../../.github/workflows/preview-checks.yml)
automatically runs a smoke test and Playwright checks against each preview
URL.

## When you're done

- Commit and push every accepted phase (see [git-workflow.md](git-workflow.md)).
- Keep the working tree clean after each completed phase.
- Stop the Codespace (**Codespaces** panel > **Stop codespace**) to avoid
  unnecessary usage. Don't delete it until everything is committed and
  pushed.
