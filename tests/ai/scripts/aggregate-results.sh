#!/usr/bin/env bash
# Aggregates verdict.json files from a results run into one summary table.
# Exit 0 iff every verdict is "pass". Used by test-all.sh as the final gate.
#
# WHY shell + jq (not a TS/Py script): zero deps, runs anywhere, and the
# verdict.json schema is intentionally tiny (4 fields) so a 30-line script
# beats hauling in a runtime.
#
# Usage: aggregate-results.sh <results-root>
#        e.g. aggregate-results.sh tests/ai/results/run-2026-05-25T12-00-00
set -euo pipefail

ROOT="${1:?usage: aggregate-results.sh <results-root>}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq required (brew install jq)" >&2; exit 2
fi

shopt -s nullglob
VERDICTS=("$ROOT"/*/verdict.json)
if [[ ${#VERDICTS[@]} -eq 0 ]]; then
  echo "No verdict.json found under $ROOT" >&2; exit 1
fi

pass=0; fail=0; err=0
# Token + cost columns make "passing but flailing" visible at a glance. Cost is
# accumulated in 1/10000-dollar integer units (bash has no float math) and
# divided back out with awk at the end.
total_cost_units=0; total_tokens=0
printf "\n%-46s  %-6s  %-5s  %-9s  %-8s  %s\n" "SCENARIO" "VERDICT" "STEPS" "TOKENS" "COST" "REASON"
printf -- "------------------------------------------------------------------------------------------------------------\n"
for v in "${VERDICTS[@]}"; do
  scen="$(basename "$(dirname "$v")")"
  verdict="$(jq -r '.verdict' "$v")"
  steps="$(jq -r '.steps // "?"' "$v")"
  tokens="$(jq -r '.tokens.total // 0' "$v")"
  reason="$(jq -r '.reason // ""' "$v" | head -c 40)"
  # n/a when no pricing configured (costUsd null); otherwise a 4dp dollar string.
  cost_str="$(jq -r 'if (.costUsd // null) == null then "n/a" else "$" + ((.costUsd * 10000 | round / 10000) | tostring) end' "$v")"
  total_tokens=$((total_tokens + ${tokens%%.*}))
  units="$(jq -r '((.costUsd // 0) * 10000) | round' "$v")"
  total_cost_units=$((total_cost_units + units))
  case "$verdict" in
    pass) pass=$((pass+1));;
    fail) fail=$((fail+1));;
    *)    err=$((err+1));;
  esac
  printf "%-46s  %-6s  %-5s  %-9s  %-8s  %s\n" "$scen" "$verdict" "$steps" "$tokens" "$cost_str" "$reason"
done
printf -- "------------------------------------------------------------------------------------------------------------\n"
total_cost="$(awk "BEGIN { printf \"%.4f\", $total_cost_units / 10000 }")"
printf "Totals: pass=%d  fail=%d  error=%d  tokens=%d  cost=\$%s  (root: %s)\n\n" \
  "$pass" "$fail" "$err" "$total_tokens" "$total_cost" "$ROOT"

# Non-zero exit if anything wasn't a pass — npm test then fails appropriately.
[[ $fail -eq 0 && $err -eq 0 ]]
