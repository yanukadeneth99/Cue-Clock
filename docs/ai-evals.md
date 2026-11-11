# AI pipeline history

This is a record of an experiment that has ended. Nothing here is running.

## What it was

A set of GitHub Actions workflows let AI sort new issues, write fixes as pull requests, repair failing builds, review pull requests, scan for bugs each week, draft release notes and send a daily digest. A monthly score tracked how healthy the loop was.

## When it ran

From 2026-06-15 (first logged pull request) to 2026-10-09 (last logged pull request).

## Monthly score

The score is a 0 to 100 health mark: how much of the AI's opened work was merged (50%), how much finished work needed no human rescue (30%), and how little automated repair churn the month took (20%). Higher is better. A dash means the month was too quiet to score.

| Period | AI PRs opened | AI PRs merged | Auto-fix runs | Waiting on a human | Score /100 | Research runs |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-07 | 7 | 4 | 17 | 2 | 58 | - |
| 2026-08 | 16 | 13 | 34 | 0 | 83 | 10 |
| 2026-09 | 13 | 9 | 32 | 7 | 67 | 14 |
| 2026-10 | 11 | 6 | 25 | 16 | 50 | 11 |

Each row was counted over the 30 days before it was scored, so the counts do not match calendar months. The last score was 50 for 2026-10, scored on 2026-10-01.

## Totals

- AI-written pull requests: 43 opened, 29 merged, 11 still open, 3 closed without merging.
- Dependabot pull requests: 71 opened, 36 merged, 7 still open, 28 closed without merging (mostly replaced by newer updates).

## What we learned

- A broken build step went unnoticed for weeks. From mid-September, one CI step (`android-actions/setup-android@v3`) asked Google for an SDK package that no longer exists, so the Android check failed on every app pull request. It was fixed in #262 by moving to `setup-android` v4.0.4.
- The auto-fixer failed silently. It found the right fix but could not push it, and it did not report that, so stuck pull requests never reached a human.
- Two AI workflows followed rules that contradicted each other. The fixer and the reviewer had opposite rules for Expo package updates, so 5 pull requests from August got stuck, each one waiting on the other.
- Some issues were never sorted. A timing problem in the issue decider meant some issues made by bots were never triaged.
- The workflows could not learn. Each workflow ran alone, could not see what the others were doing, and could not learn from past runs.

## Verdict

Retired on 2026-10-09. It was unreliable for a small app. It is replaced by a minimal flow that a human approves: a person writes release notes and publishes releases by hand.
