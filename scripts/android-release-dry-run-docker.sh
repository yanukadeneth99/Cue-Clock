#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${IMAGE_NAME:-cue-clock-android-dry-run}"

docker build -f "$ROOT_DIR/docker/Dockerfile.android" -t "$IMAGE_NAME" "$ROOT_DIR"

docker run --rm -t \
  -e VERSION_TAG="${VERSION_TAG:-${1:-v0.0.24}}" \
  -e VERSION_CODE="${VERSION_CODE:-}" \
  -e EAS_PROJECT_ID="${EAS_PROJECT_ID:-}" \
  -e EAS_OWNER="${EAS_OWNER:-}" \
  -e EXPO_PUBLIC_CLARITY_KEY="${EXPO_PUBLIC_CLARITY_KEY:-}" \
  -e OUTPUT_DIR=/workspace/.artifacts/android-release-dry-run \
  -v "$ROOT_DIR:/workspace" \
  "$IMAGE_NAME" \
  bash /workspace/scripts/android-release-dry-run.sh
