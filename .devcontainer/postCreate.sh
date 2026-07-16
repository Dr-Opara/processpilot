#!/usr/bin/env bash
# Runs once when the Codespace container is created. Installs dependencies
# using the repository's package manager — never expected to run on a
# personal machine.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing npm dependencies"
npm ci

echo "==> Installing Playwright's Chromium browser (for npm run test:e2e)"
npx playwright install --with-deps chromium || {
  echo "Playwright browser install failed or was skipped — run 'npm run test:e2e:install' manually later."
}

if ! command -v claude >/dev/null 2>&1; then
  echo "==> Installing Claude Code CLI"
  npm install -g @anthropic-ai/claude-code || {
    echo "Claude Code CLI install skipped — it may already be provided by the VS Code extension."
  }
fi

mkdir -p /commandhistory
touch /commandhistory/.bash_history

echo "==> Codespace ready. Run 'npm run dev' and open the forwarded port-3000 URL."
