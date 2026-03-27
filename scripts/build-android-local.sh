#!/bin/bash
# Local Android APK build using the same Docker environment as CI.
# Outputs: app/android/app/build/outputs/apk/release/app-release-unsigned.apk
#
# Usage:
#   ./scripts/build-android-local.sh              # unsigned debug APK
#   ./scripts/build-android-local.sh --release    # signed release APK (requires keystore env vars)
#
# Required env vars for --release:
#   KEYSTORE_PATH      — absolute path to your .keystore file
#   KEYSTORE_PASSWORD  — keystore password
#   KEY_ALIAS          — key alias
#   KEY_PASSWORD       — key password

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="thyrlian/android-sdk:latest"
MODE="debug"

if [[ "$1" == "--release" ]]; then
  MODE="release"
fi

echo "Building Android ($MODE) in Docker..."

docker run --rm \
  -v "$REPO_ROOT/app:/app" \
  -w /app \
  -e KEYSTORE_PATH="${KEYSTORE_PATH:-}" \
  -e KEYSTORE_PASSWORD="${KEYSTORE_PASSWORD:-}" \
  -e KEY_ALIAS="${KEY_ALIAS:-}" \
  -e KEY_PASSWORD="${KEY_PASSWORD:-}" \
  "$IMAGE" bash -c "
    npm ci && \
    npx expo prebuild --platform android --clean && \
    cd android && \
    if [ '$MODE' = 'release' ] && [ -n \"\$KEYSTORE_PATH\" ]; then
      ./gradlew assembleRelease \
        -Pandroid.injected.signing.store.file=\$KEYSTORE_PATH \
        -Pandroid.injected.signing.store.password=\$KEYSTORE_PASSWORD \
        -Pandroid.injected.signing.key.alias=\$KEY_ALIAS \
        -Pandroid.injected.signing.key.password=\$KEY_PASSWORD
    else
      ./gradlew assembleDebug
    fi
  "

echo ""
echo "Build complete. APK location:"
if [ "$MODE" = "release" ]; then
  echo "  app/android/app/build/outputs/apk/release/"
else
  echo "  app/android/app/build/outputs/apk/debug/"
fi
