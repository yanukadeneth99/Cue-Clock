#!/usr/bin/env bash
# android-release-dry-run.sh
#
# Validates the full Android release build pipeline without publishing anything.
#
# Used by:
#   - CI: .github/workflows/android-release-verify.yml (runs on PRs that touch app/ or build infra)
#   - Locally: docker/Dockerfile.android provides an isolated environment to run this script
#
# What it does:
#   1. Copies source to a temp dir (never modifies your working tree)
#   2. Generates stub google-services.json and .env if missing
#   3. Generates a throwaway keystore for signing
#   4. Runs: npm ci → expo prebuild → gradlew bundleRelease
#   5. Verifies versionName and versionCode in the built AAB's AndroidManifest via aapt2
#   6. Copies the verified AAB + manifest dump to OUTPUT_DIR (.artifacts/ by default)
#
# Required env: ANDROID_HOME must be set (Android SDK root)
# Optional env: VERSION_TAG, VERSION_CODE, EAS_PROJECT_ID, EAS_OWNER, EXPO_PUBLIC_CLARITY_KEY, OUTPUT_DIR

set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_ROOT="$(mktemp -d)"
OUTPUT_DIR="${OUTPUT_DIR:-$SOURCE_ROOT/.artifacts/android-release-dry-run}"
APP_DIR="$WORK_ROOT/app"
VERSION_TAG="${VERSION_TAG:-${1:-v0.0.24}}"
VERSION="${VERSION_TAG#v}"
VERSION_CODE="${VERSION_CODE:-$(date +%s)}"
VERSION_CODE_HEX="$(printf '%x' "$VERSION_CODE")"
KEYSTORE_PATH="$APP_DIR/android/release.keystore"
AAB_PATH="$APP_DIR/android/app/build/outputs/bundle/release/app-release.aab"
EXTRACT_DIR="$APP_DIR/android/app/build/outputs/aab-inspect"

cleanup() {
  rm -rf "$WORK_ROOT"
}

trap cleanup EXIT

mkdir -p "$OUTPUT_DIR"

tar \
  --exclude='./app/node_modules' \
  --exclude='./website/node_modules' \
  --exclude='./app/android/.gradle' \
  --exclude='./app/android/app/build' \
  -cf - \
  -C "$SOURCE_ROOT" \
  . | tar -xf - -C "$WORK_ROOT"

if [[ ! -d "$APP_DIR" ]]; then
  echo "app directory not found at $APP_DIR" >&2
  exit 1
fi

if [[ ! -f "$APP_DIR/package-lock.json" ]]; then
  echo "package-lock.json not found in $APP_DIR" >&2
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([\-+][A-Za-z0-9.-]+)?$ ]]; then
  echo "Invalid VERSION_TAG '$VERSION_TAG'. Expected something like v0.0.24" >&2
  exit 1
fi

cd "$APP_DIR"

if [[ ! -f google-services.json ]]; then
  cat > google-services.json <<'EOF'
{
  "project_info": {
    "project_number": "1234567890",
    "project_id": "cue-clock-ci",
    "storage_bucket": "cue-clock-ci.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:1234567890:android:1234567890abcdef123456",
        "android_client_info": {
          "package_name": "com.yanukadeneth99.cueclock"
        }
      },
      "api_key": [
        {
          "current_key": "fake-api-key"
        }
      ]
    }
  ],
  "configuration_version": "1"
}
EOF
  echo "Created placeholder google-services.json for dry-run."
fi

cat > .env <<EOF
EAS_PROJECT_ID=${EAS_PROJECT_ID:-dev-local-open-source}
EAS_OWNER=${EAS_OWNER:-open-source-contributor}
EXPO_PUBLIC_CLARITY_KEY=${EXPO_PUBLIC_CLARITY_KEY:-}
EOF

if [[ ! -f "$KEYSTORE_PATH" ]]; then
  mkdir -p "$(dirname "$KEYSTORE_PATH")"
  keytool -genkeypair \
    -alias androidreleasekey \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storetype JKS \
    -keystore "$KEYSTORE_PATH" \
    -storepass android \
    -keypass android \
    -dname "CN=Cue Clock Dry Run, OU=CI, O=Cue Clock, L=Colombo, S=Western, C=LK"
fi

echo "Installing app dependencies..."
npm ci

echo "Preparing release version $VERSION ($VERSION_CODE)..."
VERSION="$VERSION" VERSION_CODE="$VERSION_CODE" node scripts/prepare-android-release.js

echo "Running Expo prebuild..."
export EAS_PROJECT_ID="${EAS_PROJECT_ID:-dev-local-open-source}"
export EAS_OWNER="${EAS_OWNER:-open-source-contributor}"
export EXPO_PUBLIC_CLARITY_KEY="${EXPO_PUBLIC_CLARITY_KEY:-}"
export NODE_ENV="${NODE_ENV:-production}"
npx expo prebuild --platform android --clean

echo "Syncing native Gradle version..."
VERSION="$VERSION" VERSION_CODE="$VERSION_CODE" node scripts/prepare-android-release.js --sync-native

echo "Building release AAB..."
(
  cd android
  ./gradlew bundleRelease \
    -Pandroid.injected.signing.store.file="$KEYSTORE_PATH" \
    -Pandroid.injected.signing.store.password=android \
    -Pandroid.injected.signing.key.alias=androidreleasekey \
    -Pandroid.injected.signing.key.password=android
)

if [[ ! -f "$AAB_PATH" ]]; then
  echo "Expected AAB not found at $AAB_PATH" >&2
  exit 1
fi

rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"
unzip -o -q "$AAB_PATH" base/manifest/AndroidManifest.xml -d "$EXTRACT_DIR"

BUILD_TOOLS_DIR="${ANDROID_HOME:?ANDROID_HOME must be set}/build-tools"
AAPT2_BIN="$(find "$BUILD_TOOLS_DIR" -name aapt2 -type f | sort -V | tail -n 1)"

if [[ -z "$AAPT2_BIN" ]]; then
  echo "Unable to locate aapt2 under $BUILD_TOOLS_DIR" >&2
  exit 1
fi

MANIFEST_DUMP="$("$AAPT2_BIN" dump xmltree "$EXTRACT_DIR/base/manifest/AndroidManifest.xml")"

if ! grep -q "A: android:versionName(0x0101021c)=\"$VERSION\"" <<<"$MANIFEST_DUMP"; then
  echo "Version name verification failed. Expected $VERSION" >&2
  exit 1
fi

if ! grep -q "A: android:versionCode(0x0101021b)=0x${VERSION_CODE_HEX}" <<<"$MANIFEST_DUMP"; then
  echo "Version code verification failed. Expected $VERSION_CODE" >&2
  exit 1
fi

echo "Dry-run succeeded."
cp "$AAB_PATH" "$OUTPUT_DIR/app-release-${VERSION}.aab"
printf '%s\n' "$MANIFEST_DUMP" > "$OUTPUT_DIR/manifest-${VERSION}.txt"

echo "AAB: $OUTPUT_DIR/app-release-${VERSION}.aab"
echo "Verified versionName: $VERSION"
echo "Verified versionCode: $VERSION_CODE"
