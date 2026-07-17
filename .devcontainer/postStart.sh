#!/usr/bin/env bash
# Runs every time the Codespace container starts (including resumes).
# Kept fast and side-effect-free.
set -euo pipefail

cd "$(dirname "$0")/.."

git fetch --all --prune >/dev/null 2>&1 || true

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
echo "ProcessPilot Codespace started on branch '${branch}'."
