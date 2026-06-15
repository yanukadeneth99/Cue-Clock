#!/usr/bin/env bash
# Starts the Expo web dev server in the background, waits until the bundle
# responds on http://localhost:8081, exits 0 when ready.
# Usage: boot-expo-web.sh [--port 8081]
# WHY background + HTTP poll: `expo start` is a daemon — never exits. We probe
#      the bundler's HTTP root so we know it's serving (not just listening).
# WHY CI=1: suppresses the interactive QR / keypress prompt. Without it, Expo
#      keeps stdin attached and the script blocks waiting for input.
# WHY BROWSER=none: `expo start --web` otherwise auto-opens a tab in the dev's
#      own browser — pointless here, since browser-use launches its OWN Chromium
#      to drive the test. Expo honors the BROWSER env var to skip the auto-open
#      (see github.com/expo/expo/discussions/21595). CI=1 silences the prompt but
#      does NOT stop the browser launch — this does.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/env.sh"

PORT=8081
if [[ "${1:-}" == "--port" ]]; then PORT="$2"; fi

APP_DIR="$REPO_ROOT/app"
LOG="/tmp/cueclock-expo-web.log"
PID_FILE="/tmp/cueclock-expo-web.pid"

# Kill any prior expo on this port — keeps reruns hermetic.
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Stopping previous Expo (PID $(cat "$PID_FILE"))"
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  sleep 2
fi
lsof -ti ":$PORT" | xargs -I{} kill -9 {} 2>/dev/null || true

echo "Starting Expo web on :$PORT (log: $LOG)..."
cd "$APP_DIR"
CI=1 BROWSER=none nohup npx expo start --web --port "$PORT" >"$LOG" 2>&1 &
echo $! > "$PID_FILE"
echo "Expo PID: $(cat "$PID_FILE")"

# Poll until the bundler returns 200 — first-bundle compile can take 30-60s
# on a cold cache.
for i in $(seq 1 60); do
  if curl -sf -o /dev/null "http://localhost:$PORT/"; then
    echo "Expo web ready at http://localhost:$PORT/ (after ${i}s)"
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for Expo web on :$PORT." >&2
echo "Last 20 log lines:" >&2
tail -20 "$LOG" >&2
exit 1
