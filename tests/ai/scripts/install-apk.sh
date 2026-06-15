#!/usr/bin/env bash
# Installs the Cue Clock debug APK onto the currently-attached emulator.
# Strategy: prefer the pre-built APK (fast, hermetic — what beta testers ran).
# Falls back to `expo run:android` only if no APK exists, with a loud warning.
#
# WHY prefer pre-built: a full `expo prebuild + gradle bundleDebug` is 5+ min
# on a cold M1 and re-installs node_modules. The APK at the conventional
# Gradle output path is the same artifact CI ships to internal testing, so
# running tests against it is the highest-fidelity option.
#
# Usage: install-apk.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/env.sh"

APK="$REPO_ROOT/app/android/app/build/outputs/apk/debug/app-debug.apk"
PKG="com.yanukadeneth99.cueclock"

if [[ ! -f "$APK" ]]; then
  echo "No prebuilt APK at $APK"
  echo "Run a debug build first:  cd app/android && ./gradlew app:assembleDebug -x lint -x test"
  echo "Or open app/ in Android Studio and click Run once."
  exit 2
fi

# -r reinstalls keeping data; -d allows downgrades (debug rebuilds can have
# lower versionCode than a previously-installed Play release on the AVD).
# -t allows test-only APKs (debug builds carry the testOnly flag).
echo "Installing $APK..."
adb install -r -d -t "$APK"
# Verify install. WHY `grep -F ... >/dev/null` and NOT `grep -q`: under
# `set -o pipefail` (env.sh), `grep -q` exits on first match and closes the pipe
# while `adb shell pm list packages` is still streaming, SIGPIPE-killing it
# (exit 141) and making pipefail report the pipeline as failed even on a match.
# It has "worked" only because this package sorts late in the list so grep
# usually matches near EOF — a race, not a guarantee. Dropping -q drains stdin
# fully (no SIGPIPE); output discarded.
if adb shell pm list packages | grep -F "$PKG" >/dev/null; then
  echo "OK: $PKG installed"
else
  echo "Install verification failed" >&2
  exit 1
fi
