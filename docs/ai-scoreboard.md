# AI Scoreboard

One row is added every month by the AI Evals workflow (`.github/workflows/ai-evals.yml`). It answers, in plain numbers, whether the automation is actually helping. Each row covers the 30 days before it was written.

The Score column is a 0 to 100 health mark made of three parts: how much of the AI's opened work was merged (50%), how much finished work needed no human rescue (30%), and how little automated repair churn the month took (20%). Higher is better, and a dash means the month was too quiet to score.

| Month | AI PRs opened | AI PRs merged | Dependency PRs merged | Auto-fix runs | Waiting on a human | Crash issues filed | Scanner issues filed | Issues closed by AI | Median days to merge | Score /100 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07 | 7 | 4 | 4 | 17 | 2 | 0 | 1 | 4 | 0 | 58 |
