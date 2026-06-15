#!/usr/bin/env bash
# Boots Metro and adb-reverses port 8081 so the debug APK on the AVD can load
# its JS bundle from the host.
#
# WHY this is required for Android scenarios:
#   The prebuilt app-debug.apk at app/android/app/build/outputs/apk/debug/ is a
#   *debug* build — it does NOT have the JS bundle embedded. At runtime it
#   fetches the bundle from http://10.0.2.2:8081 (or via adb-reverse from
#   localhost:8081). Without Metro running + adb reverse, the app shows React
#   Native's red error screen and the home UI never renders. Discovered the
#   hard way: cueclock-launch scenario FAILed with the agent correctly
#   diagnosing "JS bundle failed to load".
#
# Idempotent: kills any prior Metro on :8081, restarts with --clear so a stale
# delta-bundle can't ship old code.
#
# Usage:
#   boot-metro.sh
# Requires: an AVD already booted (so adb reverse can target it).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/env.sh"

APP_DIR="$REPO_ROOT/app"
LOG="/tmp/cueclock-metro.log"
PID_FILE="/tmp/cueclock-metro.pid"
PORT=8081

# Kill any prior Metro on this port — keeps reruns hermetic.
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Stopping previous Metro (PID $(cat "$PID_FILE"))"
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  sleep 1
fi
lsof -ti ":$PORT" | xargs -I{} kill -9 {} 2>/dev/null || true

# Confirm a device is actually attached — adb reverse against no device is
# silent. WHY any device (not just emulator-*): physical-phone mode targets a
# USB-connected handset whose serial is NOT emulator-*. We match any entry in
# the "device" state so this guard works for both emulator and physical runs.
if ! adb devices | awk 'NR>1 && $2=="device" {found=1} END {exit !found}'; then
  echo "No device attached (emulator or physical phone). Boot an AVD with" >&2
  echo "boot-emulator.sh, or plug in a phone with USB debugging enabled." >&2
  exit 2
fi

echo "Starting Metro on :$PORT (log: $LOG)..."
cd "$APP_DIR"
# WHY CI=1: suppresses Expo's interactive QR / keypress prompt — without it
# Metro keeps stdin attached and we'd block.
# WHY --clear: forces fresh bundle. Without this a stale .metro-cache can ship
# old JS — happened more than once during cueclock dev.
CI=1 nohup npx expo start --dev-client --port "$PORT" --clear >"$LOG" 2>&1 &
echo $! > "$PID_FILE"
echo "Metro PID: $(cat "$PID_FILE")"

# Poll until Metro's HTTP root responds.
for i in $(seq 1 60); do
  if curl -sf -o /dev/null "http://localhost:$PORT/status" 2>/dev/null \
     || curl -sf -o /dev/null "http://localhost:$PORT/" 2>/dev/null; then
    echo "Metro ready at http://localhost:$PORT/ (after ${i}s)"
    break
  fi
  sleep 1
  if [[ $i -eq 60 ]]; then
    echo "Timed out waiting for Metro. Last 20 lines:" >&2
    tail -20 "$LOG" >&2
    exit 1
  fi
done

# Reverse-forward 8081 on every attached device (emulator OR physical phone) so
# the app sees Metro at localhost:8081 from on-device. Without this the app
# cannot fetch the JS bundle on first launch. adb reverse works identically
# over USB to a real phone — that's how RN dev against hardware loads its bundle.
adb devices | awk 'NR>1 && $2=="device" {print $1}' | while read -r dev; do
  echo "adb reverse on $dev"
  adb -s "$dev" reverse tcp:$PORT tcp:$PORT
done

echo "Metro + adb reverse ready."

# Pre-warm the JS bundle. WHY: the first request to /index.bundle is what
# actually triggers Babel + Metro to compile the bundle (cold ~10-15s). If the
# app launches before that finishes, Android's "ANR" watchdog fires within ~5s
# of an unresponsive main thread and Android shows the "App not responding"
# dialog — which the test harness (correctly) reads as a failure. By hitting
# /index.bundle here BEFORE we hand control to the test agent, we shift the
# cost from "during scenario" to "during setup" — outside the agent's clock.
# The platform=android query param matches what the app sends at launch.
# WHY this URL (not /index.bundle): Expo SDK 55 + expo-router projects don't
# expose a top-level /index.bundle — the entry point is expo-router/entry.js
# and Metro serves it under its own path. The metro log confirms this is what
# the app itself fetches at launch ("Android Bundled ... node_modules/expo-router/entry.js").
# Using the wrong URL returns 404 instantly and the retry loop spins for no reason.
BUNDLE_URL="http://localhost:$PORT/node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false"
echo "Pre-warming JS bundle (cold compile ~40-60s for ~1500 modules)..."
WARM_START=$SECONDS
# WHY a retry loop (not a single curl): even after /status answers, Metro's
# bundler subsystem may not be ready for /index.bundle requests for another
# 2-5s — early requests get connection-reset instantly (curl exit 7/56).
# We retry every 3s for up to 3 minutes; each attempt has its own 120s budget
# because the compile itself takes ~50s on first run.
WARM_OK=0
for attempt in $(seq 1 8); do
  if curl -sf -o /dev/null --max-time 120 "$BUNDLE_URL"; then
    WARM_OK=1
    break
  fi
  echo "  pre-warm attempt $attempt: not ready yet, retrying in 3s"
  sleep 3
done
if [[ $WARM_OK -eq 1 ]]; then
  echo "Bundle warmed in $((SECONDS - WARM_START))s."
else
  # Non-fatal: scenarios may still pass if the agent's first ANR retry succeeds.
  # But log loudly so a flaky-first-launch failure is traceable to bundle warmup.
  echo "WARN: bundle pre-warm failed after 8 attempts — first-launch ANR likely." >&2
fi
