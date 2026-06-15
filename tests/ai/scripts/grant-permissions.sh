#!/usr/bin/env bash
# Grants the OS-level permissions Cue Clock's alarm features need, scoped
# STRICTLY to the configured package. Designed to be safe on a primary /
# daily-driver phone:
#   - Touches ONLY the configured appPackage (read from config.json). It never
#     iterates other packages and never passes a wildcard.
#   - Never uses root / su.
#   - Changes NO global OS setting and NO other app. The single system-level
#     list it touches is the Doze battery whitelist, and it adds/removes ONLY
#     our package there.
#   - Idempotent. Every grant is non-fatal: app-op NAMES vary across Android
#     versions / OEM skins, so an unsupported op is logged as "skip", not an
#     abort.
#   - Fully reversible: `grant-permissions.sh revoke` returns every setting it
#     touched back to its default and removes our package from the Doze list.
#
# WHY it is re-run after every `pm clear` (called from reset-app-state.sh):
#   pm clear resets the package to factory, revoking its runtime permissions and
#   app-ops. A once-after-install grant would be wiped by the first per-scenario
#   reset, so grants must be re-applied after each clear. (The Doze whitelist
#   survives pm clear, but +pkg is idempotent, so re-adding is harmless.)
#
# WHAT IT CANNOT DO: MIUI / HyperOS "Autostart" is a Xiaomi-proprietary setting
#   not exposed to non-root adb. Toggle it manually once per (re)install if you
#   test cold-start (app-killed) alarm delivery. Foreground / warm-resume alarm
#   paths do not need it (the harness launches the app itself).
#
# Usage:
#   grant-permissions.sh           # grant (default)
#   grant-permissions.sh grant
#   grant-permissions.sh revoke    # undo everything this script grants

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/env.sh"

MODE="${1:-grant}"

# Pull the package from config.json so this script can NEVER target the wrong
# app — same source-of-truth guard as reset-app-state.sh.
PKG="$(jq -r .appPackage "$HARNESS_DIR/config.json")"
if [[ -z "$PKG" || "$PKG" == "null" ]]; then
  echo "appPackage missing from config.json" >&2
  exit 2
fi

# Accept any attached device (emulator or physical phone).
if ! adb devices | awk 'NR>1 && $2=="device" {found=1} END {exit !found}'; then
  echo "No device attached (emulator or physical phone)." >&2
  exit 2
fi

# Safety guard: only operate if the package is actually installed, so we never
# create dangling grants for an absent/wrong package.
# WHY `grep -Fx ... >/dev/null` and NOT `grep -qx`: with `set -o pipefail` (from
# env.sh), `grep -q` is a trap. -q makes grep exit the instant it matches and
# close the pipe; `adb shell pm list packages` is still streaming the rest of
# the package list, so its next write gets SIGPIPE (exit 141), and pipefail
# propagates that 141 as the pipeline status — making this guard wrongly bail
# "not installed" even though grep DID match. Dropping -q forces grep to drain
# stdin to EOF (no early close, no SIGPIPE); -F is a literal match (the package
# name has dots) and -x anchors the whole line. Output is discarded via >/dev/null.
if ! adb shell pm list packages 2>/dev/null | tr -d '\r' | grep -Fx "package:$PKG" >/dev/null; then
  echo "Package $PKG is not installed on the device; nothing to do." >&2
  exit 2
fi

# Run one package-scoped adb-shell command; report per-line; never abort.
# WHY non-fatal: a missing op (OEM/version differences) should warn, not fail
# the whole setup — the other grants are still worth applying.
try() {  # try "<description>" <adb shell words...>
  local desc="$1"; shift
  if adb shell "$@" >/dev/null 2>&1; then
    echo "  ok    : $desc"
  else
    echo "  skip  : $desc (unsupported on this build — non-fatal)"
  fi
}

case "$MODE" in
  grant)
    echo "Granting alarm permissions to $PKG (package-scoped, no root)..."
    # Runtime notification permission (Android 13+). Re-applied because pm clear
    # revokes it.
    try "POST_NOTIFICATIONS"            pm grant "$PKG" android.permission.POST_NOTIFICATIONS
    # Exact alarms — the AlarmManager SET_EXACT_AND_ALLOW_WHILE_IDLE trigger.
    try "appop SCHEDULE_EXACT_ALARM"    appops set "$PKG" SCHEDULE_EXACT_ALARM allow
    # Full-screen intent (lock-screen alarm UI). Usually default-granted; forced.
    try "appop USE_FULL_SCREEN_INTENT"  appops set "$PKG" USE_FULL_SCREEN_INTENT allow
    # Background execution so a backgrounded alarm can run its handler.
    try "appop RUN_IN_BACKGROUND"       appops set "$PKG" RUN_IN_BACKGROUND allow
    try "appop RUN_ANY_IN_BACKGROUND"   appops set "$PKG" RUN_ANY_IN_BACKGROUND allow
    # Doze exemption (== Battery "Unrestricted"). System list, but +PKG adds ONLY
    # our package; reversed by `revoke`.
    try "doze whitelist +$PKG"          dumpsys deviceidle whitelist +"$PKG"
    echo "Granted. NOTE: MIUI/HyperOS 'Autostart' is NOT settable via adb —"
    echo "toggle it manually once per (re)install for cold-start alarm tests."
    ;;
  revoke)
    echo "Reverting alarm permissions for $PKG (returns each to default)..."
    try "appop SCHEDULE_EXACT_ALARM -> default"   appops set "$PKG" SCHEDULE_EXACT_ALARM default
    try "appop USE_FULL_SCREEN_INTENT -> default" appops set "$PKG" USE_FULL_SCREEN_INTENT default
    try "appop RUN_IN_BACKGROUND -> default"      appops set "$PKG" RUN_IN_BACKGROUND default
    try "appop RUN_ANY_IN_BACKGROUND -> default"  appops set "$PKG" RUN_ANY_IN_BACKGROUND default
    try "doze whitelist -$PKG"                    dumpsys deviceidle whitelist -"$PKG"
    try "revoke POST_NOTIFICATIONS"               pm revoke "$PKG" android.permission.POST_NOTIFICATIONS
    echo "Reverted. (MIUI/HyperOS Autostart, if you enabled it manually, must"
    echo "be turned off manually too — this script never touched it.)"
    ;;
  *)
    echo "usage: grant-permissions.sh [grant|revoke]" >&2
    exit 2
    ;;
esac
