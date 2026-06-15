#!/usr/bin/env bash
# Shared env bootstrap for the AI test harness.
# WHY: sdkmanager/avdmanager hang or error silently without JDK 17 on macOS;
#      pinning JAVA_HOME per-invocation keeps the user's global shell untouched.
# Sourced by every other script in this dir.

set -euo pipefail

# Resolve repo root regardless of where the caller cd'd to.
# WHY ${BASH_SOURCE[0]:-$0}: bash sets BASH_SOURCE when sourced; zsh doesn't,
# so a manual `source env.sh` from a zsh poke-around session would warn and
# misresolve. Falling through to $0 keeps the script portable.
_ENV_SH_SELF="${BASH_SOURCE[0]:-$0}"
HARNESS_DIR="$(cd "$(dirname "$_ENV_SH_SELF")/.." && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"

# Android SDK locations (Android Studio default on macOS).
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
export ANDROID_HOME="$ANDROID_SDK_ROOT"

# JDK 17 is required by sdkmanager/avdmanager (newer SDK XML); pinned per-call.
if /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
fi

export PATH="$JAVA_HOME/bin:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"

# Load Gemini key from gitignored .env if not already exported.
if [[ -z "${GEMINI_API_KEY:-}" && -f "$HARNESS_DIR/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$HARNESS_DIR/.env"; set +a
fi
