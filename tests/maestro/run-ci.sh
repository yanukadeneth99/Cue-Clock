#!/usr/bin/env bash
# Runs each Maestro flow on its own on the CI emulator, so one lost connection does not fail every flow after it.
# If a flow fails, it saves the device state, reconnects, and tries that flow once more.
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

results=()
failed=0
# Only the top-level flows. The helpers in flows/common/ are not run on their own.
# LC_ALL=C keeps the name order the same on every machine.
export LC_ALL=C
shopt -s nullglob
for flow in "$FLOWS_DIR"/*.yaml; do
  name=$(basename "$flow" .yaml)
  echo "=== $name ==="
  wait_for_device
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
  $ADB reconnect offline >/dev/null 2>&1 || true
  wait_for_device

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
