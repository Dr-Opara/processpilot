#!/usr/bin/env bash
# Runs the full local validation suite a phase must pass before it is
# committed and pushed from the Codespace. Mirrors what CI checks in
# .github/workflows/ci.yml, so a green run here means CI should be green too.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Formatting check"
npm run format:check

echo "==> Lint"
npm run lint

echo "==> Typecheck"
npm run typecheck

echo "==> Unit tests"
npm run test

echo "==> Production build"
npm run build

echo
echo "All checks passed. Review 'git status' and 'git diff', then commit and push:"
echo "  git add <files>"
echo "  git commit -m \"<message>\""
echo "  git push -u origin \$(git rev-parse --abbrev-ref HEAD)"
