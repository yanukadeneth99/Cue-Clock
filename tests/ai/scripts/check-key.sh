#!/usr/bin/env bash
# Validates GEMINI_API_KEY against the live API with a $0 ping.
# WHY: a stale/missing key is the #1 silent failure mode; catching it before
#      Metro/AVD boot saves ~2min of wasted setup.
# WHY thinkingBudget=0: this is a triviality check — no need to burn output
#      budget on chain-of-thought; we just want HTTP 200 + a token back.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/env.sh"

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "GEMINI_API_KEY missing. Copy tests/ai/.env.example to tests/ai/.env and fill it in." >&2
  exit 1
fi

RESPONSE=$(curl -sS -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -d '{
    "contents":[{"parts":[{"text":"Reply with the single word: OK"}]}],
    "generationConfig":{"maxOutputTokens":16,"thinkingConfig":{"thinkingBudget":0}}
  }')

if echo "$RESPONSE" | grep -q '"text"'; then
  echo "Gemini key OK."
else
  echo "Gemini key check failed. Response:" >&2
  echo "$RESPONSE" >&2
  exit 1
fi
