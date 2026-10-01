#!/usr/bin/env bash
# Cloud sessions start from a fresh clone: install dependencies so tests, lint and the skills'
# helper sims run straight away. Local machines (no CLAUDE_CODE_REMOTE) are left alone.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
if [ ! -x node_modules/.bin/vitest ]; then
  npm ci --no-audit --no-fund --loglevel=error >/dev/null 2>&1 || npm install --no-audit --no-fund --loglevel=error >/dev/null 2>&1
fi
