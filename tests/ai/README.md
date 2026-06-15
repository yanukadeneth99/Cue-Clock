# AI E2E Test Harness

Local-only AI-driven E2E testing for Cue Clock. Hosted Gemini drives `browser-use` (web) and `agent-device` via LangChain.js (Android). Designed to be portable across Expo/web projects.

## Quick start

```bash
# 1. Get a Gemini API key from https://aistudio.google.com/app/apikey
cp tests/ai/.env.example tests/ai/.env
# Edit tests/ai/.env and paste your key

# 2. From app/ — run everything
cd app
npm test               # web + both AVDs (sequential)
npm run test:web       # web only
npm run test:android   # android only (both AVDs)
```

## Design

- **Provider:** Google AI Studio (Gemini API, direct — not via OpenRouter/OpenAI shims)
- **Default model:** `gemini-2.5-flash` (multimodal, native tools, ~free tier)
- **Sequential by design:** web → kill → modern AVD → kill → old AVD → kill (8GB RAM constraint)
- **Scenarios are plain markdown** in `scenarios/{web,android}/*.md` with `Setup / Steps / Expected / Verdict format` sections — portable across projects

## Files

- `config.json` — app package, AVD list, model selection
- `.env` — `GEMINI_API_KEY` (gitignored)
- `scenarios/` — test scenarios as `.md`
- `shared/` — TS scenario loader + results writer
- `android/` — LangChain.js + LangGraph agent driving `agent-device` CLI
- `web/` — Python `browser-use` runner using `ChatGoogle`
- `scripts/` — orchestrator + per-platform boot scripts
- `results/` — gitignored output (verdict.json, frames/, trace.jsonl)

## Performance notes (Phase 0 measured, 2026-05-25)

| Metric                                              | Value                    |
| --------------------------------------------------- | ------------------------ |
| Round-trip latency (plain chat, 14 tok)             | 1.09s                    |
| Round-trip latency (tool call, 172 tok w/ thinking) | 1.81s                    |
| Cost per call (typical agent step, ~200 tok)        | ~$0.00002                |
| Estimated cost per full `npm test` (~300 calls)     | < $0.01                  |
| Free tier headroom                                  | 1500 req/day, 1M tok/day |

## Gotchas discovered

- **`gemini-2.5-flash` has thinking ON by default.** Thinking tokens count against `maxOutputTokens`. If your budget is too low, the response can hit `MAX_TOKENS` with zero visible content. Defaults baked into runners: `maxOutputTokens: 1024`, `thinkingConfig.thinkingBudget: 512`. For trivial cheap calls (key validation, etc.) set `thinkingBudget: 0`.
- **Native function-calling shape** uses `functionDeclarations` (request) and `functionCall` (response), not OpenAI's `tools`/`tool_calls`. `ChatGoogle` and `ChatGoogleGenerativeAI` handle this — if you ever drop to raw curl, remember.

## Porting to another app

1. Copy `tests/ai/` to the new repo.
2. Edit `config.json` — change `appPackage`, `appActivity`, `expoWebUrl`.
3. Replace `scenarios/{web,android}/*.md` with your app's flows.
4. `cp .env.example .env` and add key.
5. `npm test`.

The harness contains no Cue-Clock imports — domain knowledge lives entirely in `scenarios/`.
