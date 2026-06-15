#!/usr/bin/env bash
# Top-level orchestrator for the AI E2E harness.
# Modes:
#   web       — run every scenario in tests/ai/scenarios/web
#   android   — run every Android scenario on every configured AVD
#   modern    — Android, only the "modern" AVD (Pixel_9_API36)
#   old       — Android, only the "old" AVD (Pixel_4_API30)
#   device    — Android, on a USB-connected PHYSICAL phone (no emulator boot)
#   both      — web + android (default)
#
# WHY a physical-device mode: on an 8GB Mac the emulator + Metro + LLM runner
# thrash RAM (heavy pageouts) and the software-GPU emulator starves SystemUI
# into ANRs / black screens. Running against a real phone removes the emulator
# from the host budget entirely — the phone renders on its own RAM/GPU. The
# device must be plugged in with USB debugging on and showing as "device" in
# `adb devices`. With >1 physical device, set ANDROID_SERIAL=<serial> first.
#
# Flags:
#   --no-expo         skip booting the Expo web dev server (use for smokes
#                     that point at external URLs like example.com)
#   --no-install      skip APK install (assume already installed on the AVD)
#   --scenarios <glob> only run scenarios whose path matches glob (eg "smoke-*")
#   --keep-going      run EVERY scenario even after one fails (default is
#                     fail-fast: stop at the first non-pass to save API credits)
#   --fail-fast       explicit opt-in to the default stop-on-first-failure
#
# WHY one orchestrator (not separate web/android entry points):
#   `npm test` is the contract. A single script that fans out keeps that
#   contract simple and means CI just calls one thing. The aggregator at the
#   end gives a single pass/fail exit code regardless of mode.
#
# WHY sequential execution: 8GB M1 — running the AVD, Expo Metro, and two
#   LLM-driven runners concurrently OOMs reliably. Sequential is the only
#   honest answer for this hardware.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/env.sh"

MODE="${1:-both}"; shift || true
NO_EXPO=0; NO_INSTALL=0; SCEN_GLOB="*"; HEADLESS_FLAG=0
# FAIL_FAST default ON: each LLM-driven scenario costs real API credits, and a
# failure is rarely "the next scenario will be fine" — it usually means the
# device/Metro/app got into a bad state. So by default we STOP at the first
# non-pass and skip the rest instead of burning credits on scenarios likely to
# fail too. Pass --keep-going to run the full matrix regardless (e.g. when you
# want a complete pass/fail report and don't mind the cost). SUITE_ABORTED is the
# cross-loop signal that fail-fast tripped (see on_scenario_exit).
FAIL_FAST=1; SUITE_ABORTED=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-expo)     NO_EXPO=1 ;;
    --no-install)  NO_INSTALL=1 ;;
    --scenarios)   SCEN_GLOB="$2"; shift ;;
    --headless)    HEADLESS_FLAG=1 ;;  # opt-out of default visible mode
    --fail-fast)   FAIL_FAST=1 ;;      # explicit (already the default)
    --keep-going)  FAIL_FAST=0 ;;      # run every scenario even after a failure
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

# DEFAULT IS VISIBLE during Phase 5 verification — user wants to see every
# test run live. Pass --headless to revert to background mode. Exported once
# so every downstream script (boot-emulator, runner.py) sees it.
if [[ $HEADLESS_FLAG -eq 1 ]]; then
  export VISIBLE=0
else
  export VISIBLE=1
fi

# One results root per run — keeps each invocation's artifacts grouped so
# aggregate-results.sh has a clean glob target.
RUN_TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
RUN_ROOT="$HARNESS_DIR/results/run-$RUN_TS"
mkdir -p "$RUN_ROOT"
echo "[orch] mode=$MODE  run=$RUN_ROOT"

# Track every child process we spawn so we can tear them down on exit/error.
# Without this, a failed scenario leaves Expo Metro and a headless emulator
# running until the user notices — bad for an 8GB box.
CHILD_PIDS=()
cleanup() {
  local rc=$?
  echo "[orch] cleanup (rc=$rc)"
  if [[ -f /tmp/cueclock-expo-web.pid ]]; then
    kill "$(cat /tmp/cueclock-expo-web.pid)" 2>/dev/null || true
    rm -f /tmp/cueclock-expo-web.pid
  fi
  # Metro for Android (dev-client). Same teardown shape as the web Expo daemon.
  if [[ -f /tmp/cueclock-metro.pid ]]; then
    kill "$(cat /tmp/cueclock-metro.pid)" 2>/dev/null || true
    rm -f /tmp/cueclock-metro.pid
  fi
  # Kill any AVD we booted. We only stop emulator-* devices — physical phones
  # are never targeted by this script so this is safe.
  adb devices 2>/dev/null | awk '/emulator-/ {print $1}' | while read -r dev; do
    adb -s "$dev" emu kill >/dev/null 2>&1 || true
  done
  exit $rc
}
trap cleanup EXIT INT TERM

# Decide what to do after a scenario subshell exited with code $1 (name = $2).
# Returns 0 to let the caller's loop continue, non-zero to make it `break`.
# On a failure under fail-fast it sets SUITE_ABORTED so outer loops (the AVD
# matrix, the web→android `both` flow) also stop. We deliberately do NOT exit
# here: the loops unwind normally so the cleanup trap fires and the aggregator
# still summarises the scenarios that DID run.
on_scenario_exit() {
  local rc="$1" name="$2"
  [[ "$rc" -eq 0 ]] && return 0
  if [[ $FAIL_FAST -eq 1 ]]; then
    echo "[orch] ✖ $name FAILED (rc=$rc) — fail-fast: stopping the suite and skipping all" >&2
    echo "[orch]   remaining scenarios to save API credits. Re-run with --keep-going to run" >&2
    echo "[orch]   the full matrix regardless of failures." >&2
    SUITE_ABORTED=1
    return 1
  fi
  echo "[orch] $name failed (continuing — --keep-going)"
  return 0
}

run_web() {
  if [[ $NO_EXPO -eq 0 ]]; then
    "$SCRIPT_DIR/boot-expo-web.sh"
  else
    echo "[orch] --no-expo: skipping Expo boot"
  fi

  local scen
  for scen in "$HARNESS_DIR/scenarios/web/"$SCEN_GLOB.md; do
    [[ -f "$scen" ]] || continue
    local name; name="$(basename "$scen" .md)"
    echo "[orch] WEB scenario: $name"
    # Per-scenario results dir nests under the run root via RESULTS_BASE.
    # runner.py reads HARNESS_DIR/results by default — we override via env
    # so the orchestrator owns the path layout.
    local rc=0
    ( cd "$HARNESS_DIR/web" && \
      RESULTS_BASE="$RUN_ROOT" \
      uv run python runner.py "$scen" --label web ) || rc=$?
    on_scenario_exit "$rc" "web/$name" || break
  done
}

run_android_on() {
  local avd_label="$1" avd_name="$2"
  echo "[orch] === AVD: $avd_label ($avd_name) ==="
  "$SCRIPT_DIR/boot-emulator.sh" "$avd_name"

  if [[ $NO_INSTALL -eq 0 ]]; then
    "$SCRIPT_DIR/install-apk.sh" || echo "[orch] APK install failed/skipped — scenarios may fail"
  fi

  # WHY Metro boot here: the debug APK is NOT self-contained — it fetches the
  # JS bundle from Metro at runtime via adb reverse. Without this step every
  # scenario sees React Native's red error screen instead of the home UI.
  # Discovered when cueclock-launch correctly FAILed for exactly this reason.
  "$SCRIPT_DIR/boot-metro.sh" || { echo "[orch] Metro boot failed — Android scenarios will see red error screen" >&2; }

  local scen
  for scen in "$HARNESS_DIR/scenarios/android/"$SCEN_GLOB.md; do
    [[ -f "$scen" ]] || continue
    local name; name="$(basename "$scen" .md)"
    local label="android-$avd_label"

    # WHY reset-app-state before every Cue Clock scenario:
    # Without this, the FIRST scenario eats the onboarding modals (background
    # help wizard + analytics consent), and EVERY subsequent scenario starts on
    # an "already onboarded" app — which:
    # 1. Makes cueclock-launch falsely pass in 6 steps (it expects to dismiss
    #    onboarding and verify home UI — but onboarding was already gone).
    # 2. Breaks analytics-opt-out (consent already given).
    # 3. Breaks edit-cue-time / passed-strip-dismiss (presume specific cue state).
    # Smoke scenarios (don't open Cue Clock) are unaffected since reset only
    # touches the configured appPackage. Reset is cheap (~200ms).
    # Scenarios that *want* persisted state can opt out via a future
    # `<!-- no-reset -->` marker in their .md; not needed yet.
    # reset_between tells the runner to re-reset before each RETRY attempt. WHY:
    # the runner retries the whole scenario internally (model chain + same-model
    # retry); without an inter-attempt reset, a failed attempt leaves the app
    # onboarded/with cues and the next attempt fails the fresh-state Setup. Same
    # smoke-* exclusion as the pre-scenario reset above.
    local reset_between=0
    if [[ "$name" != smoke-* ]]; then
      "$SCRIPT_DIR/reset-app-state.sh" >/dev/null || echo "[orch] reset-app-state failed for $name (continuing)"
      reset_between=1
    fi

    echo "[orch] ANDROID scenario: $name on $avd_label"
    local rc=0
    ( cd "$HARNESS_DIR/android" && \
      RESULTS_BASE="$RUN_ROOT" \
      RESET_BETWEEN_ATTEMPTS="$reset_between" \
      npm run --silent run -- "$scen" --label "$label" ) || rc=$?
    on_scenario_exit "$rc" "$name on $avd_label" || break
  done

  # Stop the AVD before moving to the next one — RAM budget on 8GB doesn't
  # forgive two emulators in flight.
  adb devices | awk '/emulator-/ {print $1}' | while read -r dev; do
    adb -s "$dev" emu kill >/dev/null 2>&1 || true
  done
  sleep 2
}

# Physical-phone mode: skip emulator boot entirely; target a USB-connected
# device. WHY a separate function (not a reused run_android_on): there is no AVD
# to boot or kill, device selection differs (serial, not AVD name), and we must
# NOT tear the phone down at the end — it's the user's hardware, not a throwaway.
run_android_on_device() {
  echo "[orch] === Physical device mode ==="

  # Collect physical devices in the "device" state, excluding emulators. A phone
  # stuck in "unauthorized"/"offline" won't match — the user must accept the RSA
  # prompt on the handset first.
  local devs count
  devs="$(adb devices | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1}')"
  count="$(printf '%s\n' "$devs" | grep -c . || true)"

  if [[ "$count" -eq 0 ]]; then
    echo "[orch] No physical Android device detected." >&2
    echo "[orch] Plug in a phone, enable USB debugging, accept the RSA prompt," >&2
    echo "[orch] and confirm it shows as 'device' (not 'unauthorized') in:" >&2
    echo "[orch]   adb devices" >&2
    exit 2
  fi
  if [[ "$count" -gt 1 && -z "${ANDROID_SERIAL:-}" ]]; then
    echo "[orch] Multiple physical devices attached:" >&2
    printf '[orch]   %s\n' $devs >&2
    echo "[orch] Pick one: ANDROID_SERIAL=<serial> bash $0 device ..." >&2
    exit 2
  fi

  # Pin EVERY downstream adb call (install, Metro reverse, reset) to this one
  # device. adb honors ANDROID_SERIAL natively, so no -s threading is needed.
  export ANDROID_SERIAL="${ANDROID_SERIAL:-$devs}"
  echo "[orch] Target device: $ANDROID_SERIAL"

  # agent-device does NOT read ANDROID_SERIAL. It has its own persistent daemon
  # whose "default" session binds to whatever device it first discovered and
  # stays bound across runs — on this machine that ghost is the retired
  # emulator-5554, which the agent kept re-targeting (causing the FAIL: 'Device
  # emulator-5554 not found', and transient adb pollution that broke the
  # post-clear package check). Releasing the session here lets tools.ts's
  # --serial (AGENT_DEVICE_SERIAL, below) cleanly (re)bind it to the phone.
  # Non-fatal: a fresh machine with no prior session has nothing to close.
  agent-device close >/dev/null 2>&1 || true
  # tools.ts appends `--serial $AGENT_DEVICE_SERIAL` to every agent-device call.
  # The adb transport serial works directly as agent-device's --serial value.
  export AGENT_DEVICE_SERIAL="$ANDROID_SERIAL"
  echo "[orch] agent-device pinned to --serial $AGENT_DEVICE_SERIAL"

  if [[ $NO_INSTALL -eq 0 ]]; then
    "$SCRIPT_DIR/install-apk.sh" || echo "[orch] APK install failed/skipped — scenarios may fail"
  fi

  # Same Metro requirement as emulator mode: the debug APK fetches its JS bundle
  # from Metro over adb-reverse (works identically over USB to a real phone).
  "$SCRIPT_DIR/boot-metro.sh" || { echo "[orch] Metro boot failed — scenarios will see the red error screen" >&2; }

  local scen
  for scen in "$HARNESS_DIR/scenarios/android/"$SCEN_GLOB.md; do
    [[ -f "$scen" ]] || continue
    local name; name="$(basename "$scen" .md)"
    # Same per-scenario reset contract as emulator mode (see run_android_on),
    # including reset-between-retries via RESET_BETWEEN_ATTEMPTS.
    local reset_between=0
    if [[ "$name" != smoke-* ]]; then
      "$SCRIPT_DIR/reset-app-state.sh" >/dev/null || echo "[orch] reset-app-state failed for $name (continuing)"
      reset_between=1
    fi
    echo "[orch] ANDROID scenario: $name on device $ANDROID_SERIAL"
    local rc=0
    ( cd "$HARNESS_DIR/android" && \
      RESULTS_BASE="$RUN_ROOT" \
      RESET_BETWEEN_ATTEMPTS="$reset_between" \
      npm run --silent run -- "$scen" --label "android-device" ) || rc=$?
    on_scenario_exit "$rc" "$name on device" || break
  done

  # Deliberately do NOT kill the phone. cleanup() only kills emulator-* devices
  # and Metro, so the user's handset is left untouched.
  echo "[orch] device run complete (phone left connected)."
}

run_android_modes() {
  local filter="$1"  # "all" | "modern" | "old"
  # Use jq to pull AVDs out of config.json so the AVD list lives in one place.
  local rows
  rows="$(jq -r '.avds[] | "\(.label) \(.name)"' "$HARNESS_DIR/config.json")"
  while read -r label name; do
    [[ -z "$label" ]] && continue
    if [[ "$filter" != "all" && "$filter" != "$label" ]]; then continue; fi
    run_android_on "$label" "$name"
    # fail-fast tripped inside this AVD — don't boot the next emulator.
    [[ $SUITE_ABORTED -eq 1 ]] && break
  done <<< "$rows"
}

case "$MODE" in
  web)     run_web ;;
  android) run_android_modes all ;;
  modern)  run_android_modes modern ;;
  old)     run_android_modes old ;;
  device)  run_android_on_device ;;
  both)    run_web; [[ $SUITE_ABORTED -eq 1 ]] || run_android_modes all ;;
  *) echo "usage: test-all.sh [web|android|modern|old|device|both] [--no-expo] [--no-install] [--scenarios <glob>] [--headless] [--keep-going|--fail-fast]" >&2; exit 2 ;;
esac

# Note the early stop so the partial totals below aren't mistaken for a full run.
if [[ $SUITE_ABORTED -eq 1 ]]; then
  echo "[orch] suite stopped early (fail-fast). Aggregating only the scenarios that ran:"
fi

# Final gate: aggregator returns non-zero if anything wasn't a pass (it counts
# whatever verdict.json files exist, so a fail-fast partial run reports cleanly).
"$SCRIPT_DIR/aggregate-results.sh" "$RUN_ROOT"
