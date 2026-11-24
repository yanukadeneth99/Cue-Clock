#!/usr/bin/env bash
# Runs each Maestro flow on its own on the CI emulator, so one lost connection does not fail every flow after it.
# If a flow fails, it saves the device state and a screenshot, reconnects, and tries that flow once more.
# Usage: bash tests/maestro/run-ci.sh <output folder>
set -u
OUT=${1:?usage: run-ci.sh <output folder>}
ADB=${ADB:-adb}
FLOWS_DIR="$(cd "$(dirname "$0")" && pwd)/flows"
mkdir -p "$OUT"

# Wait up to 120 seconds until the emulator is connected, online and fully started.
wait_for_device() {
  local deadline=$((SECONDS + 120))
  timeout 120 $ADB wait-for-device || true
  while [ "$SECONDS" -lt "$deadline" ]; do
    local booted online
    booted=$($ADB shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
    online=$($ADB devices | grep -cE '^emulator-[0-9]+[[:space:]]+device$')
    if [ "$booted" = "1" ] && [ "$online" -ge 1 ]; then
      return 0
    fi
    sleep 2
  done
  echo "Device was not ready after 120 seconds"
  $ADB devices -l || true
  return 1
}

# Run once: tell Android not to show crash or "isn't responding" popups, and turn off animations.
# hide_error_dialogs is Settings.Global.HIDE_ERROR_DIALOGS in the Android source (checked on Android 15).
quiet_system_popups() {
  local key
  for key in hide_error_dialogs:1 window_animation_scale:0 transition_animation_scale:0 animator_duration_scale:0; do
    if $ADB shell settings put global "${key%%:*}" "${key#*:}" >/dev/null 2>&1; then
      echo "Set ${key%%:*} to ${key#*:}"
    else
      echo "Could not set ${key%%:*} (ignored)"
    fi
  done
}

# Close any system popup already on screen, then give the screen a moment.
# If it is an "isn't responding" popup, Android also closes the stuck app. That is fine, since each flow starts the app fresh.
close_system_dialogs() {
  $ADB shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true
  sleep 2
}

results=()
failed=0
wait_for_device && quiet_system_popups
# Only the top-level flows. The helpers in flows/common/ are not run on their own.
# LC_ALL=C keeps the name order the same on every machine.
export LC_ALL=C
shopt -s nullglob
for flow in "$FLOWS_DIR"/*.yaml; do
  name=$(basename "$flow" .yaml)
  echo "=== $name ==="
  wait_for_device
  close_system_dialogs
  if maestro test --test-output-dir "$OUT/$name" "$flow"; then
    results+=("$name: pass")
    continue
  fi

  # Save what the device looked like when the flow failed, then reconnect.
  mkdir -p "$OUT/$name"
  {
    echo "--- adb devices -l ---"
    $ADB devices -l 2>&1
    echo "--- sys.boot_completed ---"
    $ADB shell getprop sys.boot_completed 2>&1
  } > "$OUT/$name/device-state.txt"
  timeout 20 $ADB exec-out screencap -p > "$OUT/$name/device-screen.png" 2>/dev/null || true
  $ADB reconnect offline >/dev/null 2>&1 || true
  wait_for_device
  close_system_dialogs

  echo "=== $name (retry) ==="
  if maestro test --test-output-dir "$OUT/$name-retry" "$flow"; then
    results+=("$name: pass on retry")
    echo "::warning title=Maestro flaky flow::$name failed once and passed on retry"
  else
    results+=("$name: fail")
    failed=1
  fi
done

if [ "${#results[@]}" -eq 0 ]; then
  echo "No flows found in $FLOWS_DIR"
  exit 1
fi

echo "=== Summary ==="
for line in "${results[@]}"; do
  echo "$line"
done
exit "$failed"
