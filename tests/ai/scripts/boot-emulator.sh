#!/usr/bin/env bash
# Boots an AVD headless, waits for boot_completed, exits 0 when ready.
# Usage: boot-emulator.sh <avd-name>
# WHY headless: -no-window keeps RAM/CPU low on the 8GB M1; -no-audio dodges
#      CoreAudio handshake stalls; -no-boot-anim shaves ~10s of cold boot;
#      -gpu swiftshader_indirect avoids Metal/host-GPU contention with Metro.
# WHY background + wait-for-device + boot_completed poll: `emulator` never
#      "returns" — it's a long-lived daemon. We background it, then trust ADB
#      to report readiness instead of sleeping a guessed duration.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/env.sh"

AVD="${1:?usage: boot-emulator.sh <avd-name>}"
LOG="/tmp/cueclock-emulator-${AVD}.log"

if ! avdmanager list avd 2>/dev/null | grep -q "Name: $AVD"; then
  echo "AVD '$AVD' not found. Run avdmanager list avd." >&2
  exit 1
fi

# Kill any previously-running emulator to keep RAM budget honest (one AVD at a time).
adb devices | awk '/emulator-/ {print $1}' | while read -r dev; do
  echo "Stopping leftover $dev"
  adb -s "$dev" emu kill >/dev/null 2>&1 || true
done
sleep 2

# WHY VISIBLE env var: lets the developer watch tests run on their screen.
# Currently DEFAULT=visible (Phase 5 verification period — user wants to see
# every test). Flip back to headless once scenarios are confirmed stable by
# setting VISIBLE=0 explicitly OR editing this default to 0.
# Costs of visible mode: ~200-300MB RAM for GUI surfaces, frame composition.
WINDOW_ARGS="-no-boot-anim"
MODE="visible"
if [[ "${VISIBLE:-1}" == "0" ]]; then
  WINDOW_ARGS="-no-window -no-audio -no-boot-anim"
  MODE="headless"
fi

echo "Booting $AVD ($MODE, log: $LOG)..."
# shellcheck disable=SC2086  # intentional word-splitting of WINDOW_ARGS
nohup emulator -avd "$AVD" \
  $WINDOW_ARGS \
  -gpu swiftshader_indirect \
  -no-snapshot-save \
  >"$LOG" 2>&1 &
EMU_PID=$!
echo "Emulator PID: $EMU_PID"

# adb wait-for-device only blocks until the daemon is reachable, not until
# Android has finished booting; sys.boot_completed=1 is the real "ready" signal.
adb wait-for-device
echo "ADB reachable; waiting for boot_completed..."
for i in $(seq 1 60); do
  if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
    echo "$AVD booted after ${i}0s window."
    adb shell input keyevent 82 >/dev/null 2>&1 || true  # unlock screen
    exit 0
  fi
  sleep 5
done

echo "Timed out waiting for $AVD to boot." >&2
exit 1
