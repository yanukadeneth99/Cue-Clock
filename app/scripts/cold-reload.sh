#!/usr/bin/env bash
# Cold-reload the Cue Clock dev build on a connected Android device.
#
# Does everything in one shot, in order:
#   1. Kills any Metro currently listening on :8081
#   2. force-stops the app on the device
#   3. (optional --wipe) clears app data via `pm clear` so onboarding,
#      AsyncStorage, and HyperOS per-app permission grants reset
#   4. Starts a fresh Metro with `--clear` (so the transformer cache is
#      rebuilt from scratch — never trust the warm cache)
#   5. Waits for Metro to report "Waiting on http://localhost:8081"
#   6. `adb reverse tcp:8081 tcp:8081` so the device can reach Metro
#   7. Launches the app via `monkey`, which fires Metro's first cold bundle
#
# Usage:
#   ./scripts/cold-reload.sh          # restart Metro + relaunch app, keep data
#   ./scripts/cold-reload.sh --wipe   # also wipe app data (re-fires onboarding)
#
# Metro logs stream to /tmp/cueclock-metro.log — `tail -f` it if a bundle
# fails or you want to see logcat-style output.

set -euo pipefail

APP_PKG="com.yanukadeneth99.cueclock"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
METRO_LOG="/tmp/cueclock-metro.log"

WIPE=0
for arg in "$@"; do
  case "$arg" in
    --wipe) WIPE=1 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "unknown flag: $arg" >&2
      exit 2
      ;;
  esac
done

echo "→ Killing Metro (port 8081 if anything is listening)…"
if lsof -ti :8081 >/dev/null 2>&1; then
  lsof -ti :8081 | xargs -I{} kill -9 {} 2>/dev/null || true
fi

echo "→ Force-stopping app on device…"
adb shell am force-stop "$APP_PKG" >/dev/null

if [ "$WIPE" = "1" ]; then
  echo "→ Wiping app data (pm clear)…"
  adb shell pm clear "$APP_PKG" >/dev/null
fi

echo "→ Starting Metro with --clear (background)…"
cd "$APP_DIR"
# Pin JDK 17 per CLAUDE.md "Local On-Device Testing" recipe.
JAVA_HOME=$(/usr/libexec/java_home -v 17) \
PATH=$(/usr/libexec/java_home -v 17)/bin:$PATH \
EXPO_PUBLIC_DEBUG_LOGS=1 CI=1 \
nohup npx expo start --dev-client --clear >"$METRO_LOG" 2>&1 &
METRO_PID=$!
echo "  Metro PID: $METRO_PID   (logs: $METRO_LOG)"

echo "→ Waiting for Metro to listen on :8081…"
for _ in $(seq 1 90); do
  if grep -q "Waiting on http://localhost:8081" "$METRO_LOG" 2>/dev/null; then
    echo "  Metro ready."
    break
  fi
  sleep 1
done

if ! grep -q "Waiting on http://localhost:8081" "$METRO_LOG" 2>/dev/null; then
  echo "✖ Metro did not become ready within 90s. Last log lines:" >&2
  tail -n 30 "$METRO_LOG" >&2
  exit 1
fi

echo "→ adb reverse tcp:8081…"
adb reverse tcp:8081 tcp:8081 >/dev/null

echo "→ Launching app…"
adb shell monkey -p "$APP_PKG" -c android.intent.category.LAUNCHER 1 >/dev/null

echo "✓ Cold reload complete."
echo "   Metro log:    tail -f $METRO_LOG"
echo "   Stop Metro:   lsof -ti :8081 | xargs kill -9"
