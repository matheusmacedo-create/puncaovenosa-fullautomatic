#!/bin/bash
set -euo pipefail

# Só roda no Claude Code on the web — em máquina local o dev cuida do próprio setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

export NEXT_TELEMETRY_DISABLED=1
echo 'export NEXT_TELEMETRY_DISABLED=1' >> "${CLAUDE_ENV_FILE:-/dev/null}"

corepack enable >/dev/null 2>&1 || true
pnpm install --prefer-frozen-lockfile
