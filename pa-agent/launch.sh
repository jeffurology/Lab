#!/usr/bin/env bash
# One-command launcher for pa-agent.
# Installs everything the first time, then starts the app and opens your browser.
# Safe to re-run — it skips steps that are already done.
set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-3100}"

echo "──────────────────────────────────────────────"
echo "  pa-agent launcher"
echo "──────────────────────────────────────────────"

# 1. Node check
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js is not installed. Install it from https://nodejs.org (v18+), then run this again."
  read -r -p "Press Enter to close…" _ || true
  exit 1
fi
echo "✓ Node $(node -v)"

# 2. Dependencies
if [ ! -d node_modules ]; then
  echo "• Installing dependencies (first run only)…"
  npm install
else
  echo "✓ Dependencies present"
fi

# 3. Playwright browser (needed to drive CoverMyMeds). Idempotent: no-ops if present.
echo "• Ensuring the Chromium browser for Playwright is installed…"
npx playwright install chromium >/dev/null 2>&1 \
  && echo "✓ Browser ready" \
  || echo "  (browser install skipped — the intake + justification still work without it)"

# 4. .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from template (DRY_RUN=on, nothing submits yet). Edit it to add Twilio, etc."
else
  echo "✓ .env present"
fi

# 5. Open the browser shortly after the server comes up
URL="http://localhost:${PORT}"
( sleep 2
  if command -v open >/dev/null 2>&1; then open "$URL"          # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" # Linux
  elif command -v start >/dev/null 2>&1; then start "$URL"       # Git-Bash on Windows
  fi ) >/dev/null 2>&1 &

echo "──────────────────────────────────────────────"
echo "  Opening ${URL}"
echo "  Stop the app with Ctrl-C in this window."
echo "──────────────────────────────────────────────"

# 6. Run (foreground, so Ctrl-C stops it cleanly)
exec npm start
