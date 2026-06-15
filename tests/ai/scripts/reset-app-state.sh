#!/usr/bin/env bash
# Clears Cue Clock app data on the attached AVD. WIPES: all cues, settings,
# analytics consent flag, onboarding-seen flag. Use BEFORE scenarios that
# depend on first-launch state (analytics consent modal, background help
# wizard).
#
# WHY a dedicated script (not a raw `adb shell pm clear` in the orchestrator):
# - Explicit intent: anyone reading test-all.sh sees "reset-app-state" and
#   knows app data will be wiped. Inline `pm clear` is easy to miss in a diff.
# - Permission scope: granting an agent permission to run this ONE script is
#   much safer than granting it general `adb shell` access. The script is
#   pinned to exactly one package; it cannot wipe other apps.
# - Audit: cumulative agent run logs say "ran reset-app-state.sh" instead of
#   listing arbitrary shell commands.
#
# Usage:
#   reset-app-state.sh
# Side effects:
#   - `pm clear` on com.yanukadeneth99.cueclock (configured in config.json)
#   - Does NOT touch any other package, the AVD itself, or host state.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/env.sh"

# Pull package name from config.json so a future fork doesn't accidentally
# wipe the wrong app. WHY config-driven: porting the harness to another app
# means editing config.json — keeping reset behavior consistent.
PKG="$(jq -r .appPackage "$HARNESS_DIR/config.json")"
if [[ -z "$PKG" || "$PKG" == "null" ]]; then
  echo "appPackage missing from config.json" >&2
  exit 2
fi

# Accept any attached device (emulator OR physical phone). WHY not emulator-only:
# physical-phone mode (the 8GB-Mac escape hatch) targets a USB handset whose
# serial is not emulator-*. pm clear works identically on real hardware.
if ! adb devices | awk 'NR>1 && $2=="device" {found=1} END {exit !found}'; then
  echo "No device attached (emulator or physical phone)." >&2
  exit 2
fi

echo "Clearing app data for $PKG..."
adb shell pm clear "$PKG"

# Re-apply OS-level permissions wiped by `pm clear`. WHY here (not once after
# install): pm clear resets the package to factory, revoking its runtime
# permissions and app-ops — so the grants must be re-applied after EVERY clear.
# All grant logic is centralized in grant-permissions.sh (package-scoped, no
# root, fully reversible) so there is one auditable place for it. This includes
# POST_NOTIFICATIONS, whose absence on Android 13+ would otherwise pop an
# OS-owned permission dialog BEFORE Cue Clock's onboarding — not something the
# app-level harness should be validating. Non-fatal so a reset still "succeeds"
# for foreground-only scenarios even if a grant op is unsupported on this build.
"$SCRIPT_DIR/grant-permissions.sh" grant || echo "grant-permissions failed (continuing)"

echo "OK: $PKG state reset (cues, settings, onboarding flags wiped; alarm permissions re-granted)."
