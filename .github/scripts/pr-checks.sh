#!/usr/bin/env bash
# Shared helper for the PR decider workflow: "are this PR's checks green?"
#
# Why this exists instead of a plain `gh pr checks`: the decider workflow runs on pull_request_target, so the decider's OWN job appears in the PR's check list and stays "pending" for as long as it is running. Asking gh whether everything is green therefore always answers "no", and `gh pr checks --watch` waits for the decider to finish while the decider waits for it — a deadlock that only ends at the job timeout.
#
# So we ignore every check that belongs to this workflow and judge only the others.

# Checks from this workflow are ignored. Must match the `name:` in claude-pr-decider.yml.
SELF_WORKFLOW="Claude PR AI Decider"

# The builds that start a fresh review on their own when they finish. Must match the `workflows:` list under `workflow_run:` in claude-pr-decider.yml.
BUILD_WORKFLOWS='["Android Release Verify","Website Verify"]'

# How long `wait` mode will keep polling before giving up. Kept under the workflow's timeout-minutes so we exit with a clear message instead of being killed mid-step.
MAX_WAIT_SECONDS=$((20 * 60))
POLL_SECONDS=30

# build_check_running <pr> <repo>
#   Returns 0 if one of the builds listed above is still running on this PR, 1 otherwise.
#
# This answers "is someone else already on their way to review this?". When one of those builds finishes it starts a brand new run of the decider, and that run does the review. So a run that got here first has nothing to gain by waiting: it would hold a machine idle for the whole build and then be shut down by the very run the build started.
#
# It deliberately asks what is RUNNING rather than which files changed. If the build has not appeared in the check list yet, this simply says "no" and the caller waits as it always did, so a pull request can never be left unreviewed by mistake.
build_check_running() {
  local pr="$1" repo="$2" raw running
  raw=$(gh pr checks "$pr" --repo "$repo" --json name,workflow,bucket 2>/dev/null) || raw='[]'
  running=$(printf '%s' "$raw" | jq -r --argjson builds "$BUILD_WORKFLOWS" '
    [ .[] | select(.bucket == "pending" and (.workflow as $w | $builds | index($w) != null)) ] | length')
  [ "$running" -gt 0 ]
}

# check_others <pr> <repo> [wait]
#   Returns 0 if every check other than this workflow's own passed.
#   Returns 1 if any of them failed, was cancelled, or (without "wait") is still running.
#   With "wait", keeps polling while checks are still running.
check_others() {
  local pr="$1" repo="$2" mode="${3:-}"
  local deadline=$(( $(date +%s) + MAX_WAIT_SECONDS ))

  while :; do
    local raw
    # A PR with no checks at all makes gh exit non-zero; treat that as "nothing to wait for".
    raw=$(gh pr checks "$pr" --repo "$repo" --json name,workflow,bucket 2>/dev/null) || raw='[]'

    # Drop our own rows, then count how many of the rest are broken vs still running. "skipping" counts as fine — a skipped check is not a failure.
    local counts failed pending
    counts=$(printf '%s' "$raw" | jq -r --arg self "$SELF_WORKFLOW" '
      [ .[] | select(.workflow != $self) ] as $others
      | [ ($others | map(select(.bucket == "fail" or .bucket == "cancel")) | length),
          ($others | map(select(.bucket == "pending")) | length) ]
      | @tsv')
    failed=$(printf '%s' "$counts" | cut -f1)
    pending=$(printf '%s' "$counts" | cut -f2)

    if [ "$failed" -gt 0 ]; then
      echo "PR #${pr}: ${failed} check(s) failed or were cancelled."
      return 1
    fi

    if [ "$pending" -eq 0 ]; then
      echo "PR #${pr}: all checks (excluding this workflow) are green."
      return 0
    fi

    if [ "$mode" != "wait" ]; then
      echo "PR #${pr}: ${pending} check(s) still running."
      return 1
    fi

    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "PR #${pr}: gave up after ${MAX_WAIT_SECONDS}s with ${pending} check(s) still running."
      return 1
    fi

    echo "PR #${pr}: ${pending} check(s) still running — waiting ${POLL_SECONDS}s."
    sleep "$POLL_SECONDS"
  done
}
