// Entry point: load env, load scenario, build agent, stream the loop,
// write verdict.json + trace.jsonl. Invoked by orchestrator (Phase 4).
//
// Usage:
//   tsx src/runner.ts <scenario.md> [--avd Pixel_9_API36] [--label modern]
//
// Assumes:
// - GEMINI_API_KEY exported (via tests/ai/scripts/env.sh sourcing .env)
// - The named AVD is already booted (orchestrator's job, not the runner's).
//   Runner does NOT boot/kill emulators — keeps it composable and parallel-safe.
//
// Model fallback chain (scenario-level retry), ONE attempt per model, no
// same-model retry:
//   primary `model` → `fallbackModel` → fail.
// WHY scenario-level (not step-level): step-level requires patching LangChain's
//   internals to detect empty AI-message content mid-loop and swap providers.
//   Scenario-level retries the whole scenario from scratch with the next model
//   on error — wasteful on tokens for failed attempts (~$0.02), but identical
//   to the Python side's approach and trivial to reason about. Promote to
//   step-level only if Phase 7 shows it's worth the engineering cost.

import { config as dotenvConfig } from "dotenv";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load tests/ai/.env explicitly (NOT $CWD/.env). WHY: the runner can be invoked
// from any working directory by the orchestrator; relying on `dotenv/config`'s
// CWD lookup silently misses the key when run from outside tests/ai/android/.
const __dirnameBoot = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirnameBoot, "../../.env") });
import { HumanMessage } from "@langchain/core/messages";
import { buildAgent, buildSystemPrompt } from "./agent.ts";
import { AutoVisual } from "./autoVisual.ts";
// TokenUsage + the vision spend meter live in tools.ts (co-located with the
// flash-lite calls that spend). The runner reads the process-wide vision total
// once at the end and prices it separately from the agent (cheaper model).
// `run` is the same agent-device shell wrapper the tools use; the end-state gate
// reuses it for an authoritative post-run snapshot (no second invocation path).
import { getVisionUsageTotal, resetRestartBudget, run, type TokenUsage } from "./tools.ts";
import { loadScenario, type Scenario } from "../../shared/scenario-loader.ts";
import { ResultsSink } from "../../shared/results-writer.ts";

const HARNESS_DIR = resolve(__dirnameBoot, "../..");
// Cap at 40 (was 30→20). WHY the second bump: with per-scenario state reset
// landed, every scenario hits Cue Clock's full first-launch flow:
//   - background-help wizard (5 cards, scroll-gated continue) ≈ 6-8 steps
//   - analytics consent + opt-out friction modal ≈ 3-5 steps
//   - cue-dependent scenarios add cue setup ≈ 6-10 more steps
//   - then the scenario's actual verification ≈ 3-5 steps
// Total: 18-28 steps minimum for cue-dependent scenarios. 30 was leaving them
// 2-3 short. 40 buys margin. POST_NOTIFICATIONS pre-grant in reset-app-state.sh
// removed one entire system modal from the path (~3 steps saved). Once
// AsyncStorage onboarding flags are pre-seeded (Phase 6.5 follow-up), drop
// this back to ~20. Cost ceiling: 40 steps × ~$0.005 ≈ $0.20 per scenario.
const MAX_STEPS = 40;

// Re-establish a fresh app state before a RETRY attempt. WHY this is necessary:
// the orchestrator resets app state ONCE before invoking the runner, but the
// runner's model-chain retry loop runs MULTIPLE attempts (one per model in the
// chain) against that single reset. A failed attempt (especially a `noFinish` that hit the
// step cap mid-flow) leaves the app dirty — onboarding already dismissed, cues
// already added. The next attempt then launches onto that polluted state and,
// for scenarios coupled to the fresh-launch guarantee, FAILS its Setup
// precondition ("Existing cues were present on the home screen"). The reset
// boundary (orchestrator, per-scenario) and the retry boundary (here,
// per-attempt) were mismatched; this realigns them so every attempt starts
// from the same clean slate the FIRST attempt got.
//
// Gated by RESET_BETWEEN_ATTEMPTS=1 (set by the orchestrator for non-smoke
// scenarios only — smoke scenarios never open Cue Clock, so resetting is both
// pointless and the orchestrator already skips their pre-scenario reset).
// Non-fatal: a reset failure logs and continues — a dirty retry is still worth
// attempting and the agent may recover. Inherits ANDROID_SERIAL/
// AGENT_DEVICE_SERIAL from the runner's env, so it targets the same device.
function resetAppStateForRetry(sink: ResultsSink, attemptIdx: number): void {
  if (process.env.RESET_BETWEEN_ATTEMPTS !== "1") return;
  const script = join(HARNESS_DIR, "scripts", "reset-app-state.sh");
  console.log(
    `[runner] resetting app state before attempt ${attemptIdx} (retry)`,
  );
  sink.log({
    kind: "thought",
    data: `[meta] reset app state before retry attempt ${attemptIdx}`,
  });
  const r = spawnSync("bash", [script], {
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env },
  });
  if (r.status !== 0) {
    const tail = (r.stderr || r.stdout || "")
      .trim()
      .split("\n")
      .slice(-3)
      .join(" | ");
    console.warn(
      `[runner] reset-app-state before attempt ${attemptIdx} failed (continuing): ${tail}`,
    );
    sink.log({
      kind: "thought",
      data: `[meta] reset before attempt ${attemptIdx} failed: ${tail}`,
    });
  }
}

type CliArgs = { scenarioPath: string; label: string };
function parseArgs(argv: string[]): CliArgs {
  const positional = argv.filter((a) => !a.startsWith("--"));
  if (positional.length < 1) {
    console.error("usage: tsx src/runner.ts <scenario.md> [--label modern]");
    process.exit(2);
  }
  const labelIdx = argv.indexOf("--label");
  const label = labelIdx >= 0 ? argv[labelIdx + 1] : "modern";
  return { scenarioPath: resolve(positional[0]), label };
}

type Cfg = {
  appPackage: string;
  llm: {
    model: string;
    fallbackModel?: string;
  };
  // Optional, editable USD-per-million-token rates used only to turn the measured
  // token counts into a rough cost figure. Kept in config (NOT hardcoded) for the
  // same reason `model` is: Google reprices, and a newer flash has different rates
  // — a one-line edit, no code change. Absent ⇒ cost is reported as null, tokens
  // are still recorded. Verify current rates at https://ai.google.dev/pricing .
  pricing?: { inputPerMTok: number; outputPerMTok: number };
  // Rates for the VISION describer (gemini-2.5-flash-lite) — a different, cheaper
  // model than the agent, so its tokens MUST be priced with its own numbers, not
  // the agent's. Absent ⇒ vision spend is priced with `pricing` as a fallback
  // (over-estimates, but never silently free). Same edit-on-reprice contract.
  visionPricing?: { inputPerMTok: number; outputPerMTok: number };
};

// Objective efficiency signal for a single attempt, accumulated from the stream
// the runner already consumes (Gemini puts usage_metadata on every AIMessage).
// WHY a tool histogram (not just a step count): a scenario can PASS while
// flailing — 15 snapshots + 6 screenshots to do a 4-tap job is "passing but
// expensive". Raw `steps` hides that; `toolCounts` exposes it so we can tell a
// tight run from a lucky one.
type RunMetrics = {
  usage: TokenUsage;
  toolCounts: Record<string, number>;
  durationMs: number;
};

type RunOutcome =
  | ({ kind: "verdict"; verdict: "pass" | "fail"; reason: string; steps: number } & RunMetrics)
  | ({ kind: "noFinish"; steps: number } & RunMetrics)
  | ({ kind: "thrown"; error: string; steps: number } & RunMetrics);

// Mechanical END-STATE gate. WHY this exists (mirrors the visual HIGH gate and
// autoVisual's whole premise — "the guarantee must not depend on the model"):
// `finish()` carries the model's NARRATIVE, not the device's truth. Observed:
// fullscreen-cue returned finish(pass, "entered and exited the On-Air view")
// while the phone was STILL in that view — a vision-estimated `press_xy` missed
// the small "Exit full screen" pill, and the near-miss only re-armed the pill's
// dim timer (the surrounding full-screen Pressable's onPress is armDim, never
// onExit). The 18-node end snapshot vs the 32-node home snapshot proved it, but
// nothing checked. This re-snapshots after the run and asserts each declared
// token is on screen; a missing token means the claimed end state is fiction.
//
// Returns null when every token is present (gate passes), else a human-readable
// mismatch reason the caller folds into a forced FAIL. We assert PRESENCE (not
// absence) on purpose: absence is unprovable when a snapshot can't be read, but
// a token that only exists on the CORRECT screen (e.g. the always-pinned
// "Add a cue" home button) cleanly distinguishes "home" from "stuck elsewhere".
async function assertEndState(
  tokens: string[],
  sink: ResultsSink,
): Promise<string | null> {
  // Settle first: the agent's final action before finish() may be a press, so
  // let the screen quiesce — otherwise we could read a mid-transition frame and
  // fail a genuine pass. Same 500ms rationale as autoVisual's DEFAULT_SETTLE_MS.
  await new Promise((r) => setTimeout(r, 500));

  // Authoritative read via the SAME text snapshot the agent uses (`-i -c`). It
  // succeeds even on the live-ticking On-Air view (only `--raw`/geometry times
  // out there), so one retry covers a transient miss without masking a real
  // unreadable state.
  let snap = "";
  let snapErr: string | null = null;
  for (let i = 0; i < 2 && !snap; i++) {
    try {
      snap = run(["snapshot", "-i", "-c"]);
    } catch (e) {
      snapErr = e instanceof Error ? e.message : String(e);
      if (i === 0) await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!snap) {
    // Couldn't read the end state at all. Conservative: a PASS we cannot confirm
    // is not a PASS. Rare — the text snapshot succeeds on both home and On-Air.
    return `end-state UNVERIFIABLE (snapshot failed: ${snapErr ?? "empty"})`;
  }

  const hay = snap.toLowerCase();
  const missing = tokens.filter((t) => !hay.includes(t.toLowerCase()));
  sink.log({
    kind: "thought",
    data: `[meta] end-state check: required=[${tokens.join(", ")}] missing=[${missing.join(", ")}]`,
  });
  if (missing.length === 0) return null;
  return `end-state MISMATCH — required on screen but absent: ${missing.join(", ")}`;
}

// Single attempt against a specific model. Returns structured outcome so the
// caller decides whether to retry. Side-effect: appends trace entries to `sink`.
async function runOnce(
  model: string,
  apiKey: string,
  scenario: Scenario,
  appPackage: string,
  sink: ResultsSink,
  attemptIdx: number,
): Promise<RunOutcome> {
  console.log(`[runner] attempt ${attemptIdx} with model=${model}`);
  sink.log({
    kind: "thought",
    data: `[meta] attempt ${attemptIdx} model=${model}`,
  });

  // Per-scenario override beats the module default. WHY: journey scenarios
  // (one long stateful operator session) legitimately need 55-70 steps and
  // declare `<!-- max-steps: N -->`; atomic scenarios stay cheap at the
  // default. Without this, the global cap would kill a journey mid-run.
  const stepCap = scenario.maxSteps ?? MAX_STEPS;
  if (scenario.maxSteps) {
    console.log(
      `[runner] scenario step cap overridden: ${stepCap} (default ${MAX_STEPS})`,
    );
  }

  // Visual mode: when the scenario declares `## Visual`, build an AutoVisual so
  // the agent's mutating tools get wrapped with a per-transition checkpoint.
  // Constructed per-attempt so its dedup signature + HIGH collector reset on a
  // retry (a fresh app launch is a fresh visual timeline).
  const hasVisual = !!(scenario.visual && scenario.visual.trim());
  const av = hasVisual ? new AutoVisual(sink) : null;

  // Fresh restart_app budget per attempt: a spiral on attempt 1 must NOT carry
  // its spent budget into the next-model attempt, and the persistence scenario
  // legitimately restarts once on every attempt.
  resetRestartBudget();

  const agent = buildAgent({ model, apiKey, av: av ?? undefined });
  const systemPrompt = buildSystemPrompt(scenario, appPackage);
  const firstUser = new HumanMessage(
    `${systemPrompt}\n\nBegin now. Call \`open_app\` first to launch the target package.`,
  );

  let lastVerdict: { verdict: "pass" | "fail"; reason: string } | null = null;
  let steps = 0;
  // Diagnostic: the finishReason of the most recent AI turn. WHY captured: a
  // `noFinish` outcome is ambiguous from the trace alone — it could be a genuine
  // empty/whitespace turn OR Gemini truncating because thinking tokens exhausted
  // maxOutputTokens (finishReason=MAX_TOKENS, the budget-sharing trap that killed
  // fullscreen-cue's verdict turn). Logging it on the noFinish path turns "the
  // model went quiet" into a precise cause we can act on instead of guessing.
  let lastAiFinishReason: string | undefined;

  // Efficiency accounting. usage is summed from each AIMessage's usage_metadata
  // (deduped by message id — streamMode "values" re-emits the full state each
  // tick, so the same AIMessage can appear more than once). t0 captures wall
  // clock so a slow run (lots of waiting/retrying) is distinguishable from a
  // token-heavy one. Date.now() is fine here — runner.ts runs under tsx/Node,
  // not the Workflow sandbox.
  const usage: TokenUsage = { input: 0, output: 0, total: 0 };
  const toolCounts: Record<string, number> = {};
  const seenUsageIds = new Set<string>();
  const t0 = Date.now();
  const metrics = (): RunMetrics => ({
    usage,
    toolCounts,
    durationMs: Date.now() - t0,
  });

  try {
    const stream = await agent.stream(
      { messages: [firstUser] },
      { recursionLimit: stepCap * 4, streamMode: "values" },
    );

    for await (const tick of stream) {
      const msgs = (tick as any).messages ?? [];
      const last = msgs[msgs.length - 1];
      if (!last) continue;

      // Accumulate token usage for ANY AIMessage (tool-call turn or plain
      // thought), once per message id. Gemini reports cumulative-per-call
      // usage_metadata, so summing across turns gives the scenario total.
      if (last._getType?.() === "ai") {
        // Capture finishReason on every AI turn so the last one is known when the
        // stream ends. The binding surfaces it under response_metadata; accept both
        // camelCase (google-genai) and snake_case spellings defensively.
        const rm = (last as any).response_metadata;
        lastAiFinishReason = rm?.finishReason ?? rm?.finish_reason ?? lastAiFinishReason;
        const um = (last as any).usage_metadata;
        const id = (last as any).id as string | undefined;
        if (um && (!id || !seenUsageIds.has(id))) {
          if (id) seenUsageIds.add(id);
          usage.input += um.input_tokens ?? 0;
          usage.output += um.output_tokens ?? 0;
          usage.total += um.total_tokens ?? 0;
        }
      }

      if (last._getType?.() === "ai" && last.tool_calls?.length) {
        for (const tc of last.tool_calls) {
          steps += 1;
          toolCounts[tc.name] = (toolCounts[tc.name] ?? 0) + 1;
          sink.log({
            kind: "tool_call",
            data: {
              name: tc.name,
              args: tc.args,
              step: steps,
              attempt: attemptIdx,
            },
          });
          console.log(
            `[a${attemptIdx} step ${steps}] ${tc.name}(${JSON.stringify(tc.args)})`,
          );
          if (tc.name === "finish") {
            lastVerdict = tc.args as {
              verdict: "pass" | "fail";
              reason: string;
            };
          }
        }
        // `finish` is the TERMINAL state — break the stream the instant we see
        // it. WHY this is mandatory (not just a prompt rule): createReactAgent
        // has no concept of a terminal tool; `finish` returns a string like any
        // other tool and the graph keeps looping LLM→tool→LLM until the model
        // emits a no-tool turn or recursionLimit (stepCap*4) trips. A confused
        // model ignores rule 5 ("don't call tools after finish") and spams
        // open_app for ~150 more PAID steps before the limit kills it (observed:
        // edit-cue finished at step 35, then open_app-looped to step 200). The
        // verdict is already captured in lastVerdict, so there is nothing to
        // wind down — bail immediately.
        if (lastVerdict) {
          console.log(
            `[a${attemptIdx}] finish() called (${lastVerdict.verdict}); breaking stream`,
          );
          break;
        }
        // HARD step cap. Without this, LangGraph's recursionLimit (MAX_STEPS*4)
        // is the real ceiling — an agent stuck in a scroll/snapshot loop can
        // burn 4x the budget before being killed. Break the stream the moment
        // we hit the logical step cap. Saves up to ~$0.10 per runaway scenario.
        if (steps >= stepCap) {
          console.warn(
            `[a${attemptIdx}] hit step cap=${stepCap}; breaking stream`,
          );
          break;
        }
      } else if (last._getType?.() === "tool") {
        const preview = String(last.content ?? "").slice(0, 400);
        sink.log({ kind: "tool_result", data: { name: last.name, preview } });
      } else if (last._getType?.() === "ai" && last.content) {
        sink.log({ kind: "thought", data: String(last.content).slice(0, 800) });
      }
    }

    // HARD VISUAL GATE. Any HIGH defect from the per-transition auto-check
    // overrides the model's verdict — this is the whole point of "both hard-fail":
    // a functionally-correct run with a clipped/occluded/overflowing screen is
    // still a FAIL, and the model never gets a vote on that.
    const visualHighs = av?.getHighFindings() ?? [];
    if (visualHighs.length) {
      const summary = visualHighs
        .map((h) => `[cp${h.checkpoint} after ${h.tool}] ${h.defects.join("; ")}`)
        .join(" | ");
      sink.log({
        kind: "thought",
        data: `[meta] visual auto-check: ${visualHighs.length} HIGH checkpoint(s): ${summary}`,
      });
      if (lastVerdict?.verdict === "pass") {
        // Override a model PASS — the run looked functionally fine but isn't.
        lastVerdict = {
          verdict: "fail",
          reason: `visual FAIL (${visualHighs.length} HIGH): ${summary}`,
        };
      } else if (lastVerdict?.verdict === "fail") {
        // Already failing — keep the model's reason but annotate the visual cause.
        lastVerdict = {
          verdict: "fail",
          reason: `${lastVerdict.reason} | visual FAIL: ${summary}`,
        };
      }
      // noFinish is left as-is: it's already a non-pass outcome, and the HIGH
      // findings are recorded in the trace above for triage.
    }

    // HARD END-STATE GATE. Only meaningful when the model PASSED (and the visual
    // gate above didn't already flip it to FAIL): a non-pass outcome needs no
    // re-snapshot. If a declared token is missing, the claimed end state is
    // fiction — override to FAIL. See assertEndState for the full why.
    if (lastVerdict?.verdict === "pass" && scenario.endStatePresent?.length) {
      const mismatch = await assertEndState(scenario.endStatePresent, sink);
      if (mismatch) {
        sink.log({ kind: "thought", data: `[meta] end-state gate FAILED: ${mismatch}` });
        lastVerdict = {
          verdict: "fail",
          reason: `end-state FAIL: ${mismatch} (model claimed pass: "${lastVerdict.reason}")`,
        };
      }
    }

    if (lastVerdict) return { kind: "verdict", ...lastVerdict, steps, ...metrics() };
    // noFinish: surface WHY the model went silent. MAX_TOKENS here means thinking
    // exhausted maxOutputTokens (raise it in agent.ts), STOP with empty content is
    // a genuine empty turn — different causes, different fixes.
    sink.log({
      kind: "thought",
      data: `[meta] noFinish after ${steps} step(s); last AI finishReason=${lastAiFinishReason ?? "unknown"}`,
    });
    console.warn(
      `[a${attemptIdx}] noFinish; last AI finishReason=${lastAiFinishReason ?? "unknown"}`,
    );
    return { kind: "noFinish", steps, ...metrics() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: "thrown", error: msg, steps, ...metrics() };
  }
}

async function main() {
  const { scenarioPath, label } = parseArgs(process.argv.slice(2));

  // WHY config sits next to scenarios (not bundled): users porting the harness
  //      to another app edit ONE file — config.json — without touching code.
  const cfg = JSON.parse(
    readFileSync(join(HARNESS_DIR, "config.json"), "utf8"),
  ) as Cfg;

  // GEMINI_API_KEY is required (the agent loop AND the vision sub-LLM in tools.ts
  // both read it). tools.ts reads process.env.GEMINI_API_KEY directly at module
  // load, so it's already available there once .env is loaded above.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      "GEMINI_API_KEY missing. Source tests/ai/scripts/env.sh or set the env var.",
    );
    process.exit(2);
  }

  const scenario = loadScenario(scenarioPath);
  // WHY RESULTS_BASE override: orchestrator groups every scenario in a run
  // under run-<ts>/. Honoring the env keeps the runner standalone-usable.
  const resultsBase = process.env.RESULTS_BASE || join(HARNESS_DIR, "results");
  const sink = new ResultsSink(resultsBase, scenario.id, label);

  // Build the model chain: primary → fallback. An unset fallback is filtered so
  // it isn't a wasted empty attempt (then the primary is the whole chain). The
  // chain exists to dodge remote failure modes (rate-limit, transient 400s, empty
  // turns) by retrying the scenario ONCE with the next, different model.
  const chain = [
    cfg.llm.model,
    cfg.llm.fallbackModel,
  ].filter((m): m is string => typeof m === "string" && m.length > 0);

  if (chain.length === 0) {
    console.error("No models configured in llm.{model,fallbackModel}.");
    process.exit(2);
  }

  console.log(`[runner] scenario=${scenario.id} label=${label}`);
  console.log(`[runner] model chain: ${chain.join(" → ")}`);
  console.log(`[runner] results -> ${sink.dir}`);

  let totalStepsAcrossAttempts = 0;
  let lastFailure: RunOutcome | null = null;
  let globalAttempt = 0;

  // Roll metrics across EVERY attempt (failed retries cost real tokens too, so
  // the scenario total must include them — that's the honest spend). mergeMetrics
  // folds one attempt's outcome into these running totals.
  const totalUsage: TokenUsage = { input: 0, output: 0, total: 0 };
  const totalToolCounts: Record<string, number> = {};
  let totalDurationMs = 0;
  const mergeMetrics = (o: RunOutcome): void => {
    totalUsage.input += o.usage.input;
    totalUsage.output += o.usage.output;
    totalUsage.total += o.usage.total;
    totalDurationMs += o.durationMs;
    for (const [name, n] of Object.entries(o.toolCounts)) {
      totalToolCounts[name] = (totalToolCounts[name] ?? 0) + n;
    }
  };

  // Billed output = total − input. WHY not `output`: for Gemini 2.5, the API's
  // `output_tokens` (candidatesTokenCount) EXCLUDES thinking tokens, but those
  // ARE billed at the output rate (the pricing page's output line reads
  // literally "including thinking tokens"). `total_tokens` (totalTokenCount)
  // INCLUDES them, so `total − input = candidates + thoughts` = the full billed
  // output. Pricing only `output` silently dropped every thinking token — that
  // was the undercount. clamp ≥0 guards a malformed usage row.
  const billedOutput = (u: TokenUsage): number => Math.max(0, u.total - u.input);

  // Cost is derived, not measured: tokens are the ground truth, this is just a
  // convenience using the editable config rates. null when no pricing configured.
  // Two pipelines, two prices: the agent (`a`) on `pricing`, the vision describer
  // (`v`, flash-lite) on the cheaper `visionPricing`. Folding vision tokens into
  // the agent total would MISprice them, so they stay a separate term.
  const costOf = (a: TokenUsage, v: TokenUsage): number | null => {
    if (!cfg.pricing) return null;
    const vp = cfg.visionPricing ?? cfg.pricing; // fallback: never silently free
    return (
      (a.input / 1_000_000) * cfg.pricing.inputPerMTok +
      (billedOutput(a) / 1_000_000) * cfg.pricing.outputPerMTok +
      (v.input / 1_000_000) * vp.inputPerMTok +
      (billedOutput(v) / 1_000_000) * vp.outputPerMTok
    );
  };

  // One-line, glanceable efficiency summary for the scenario. Lives next to the
  // PASS/FAIL line so a human watching the run sees "good vs flailing" instantly.
  const metricsLine = (): string => {
    const v = getVisionUsageTotal();
    const cost = costOf(totalUsage, v);
    const costStr = cost == null ? "n/a" : `$${cost.toFixed(4)}`;
    // `think` is the previously-invisible slice (billed, never priced before).
    const think = Math.max(0, totalUsage.total - totalUsage.input - totalUsage.output);
    const hist = Object.entries(totalToolCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `${n}×${c}`)
      .join(" ");
    return (
      `tokens: agent ${totalUsage.total} (in ${totalUsage.input}/out ${totalUsage.output}/think ${think}) ` +
      `+ vision ${v.total} (in ${v.input}/out ${v.output})  ` +
      `cost=${costStr}  wall=${(totalDurationMs / 1000).toFixed(1)}s  tools: ${hist}`
    );
  };

  // Common metadata block written into verdict.json on every terminal path, so
  // the aggregator and any later analysis read the same shape regardless of
  // pass/fail/error.
  const metaBlock = () => ({
    steps: totalStepsAcrossAttempts,
    attempts: globalAttempt,
    durationMs: totalDurationMs,
    tokens: totalUsage,
    // visionTokens: the flash-lite describer spend, recorded separately because
    // it's a different model/price. Additive field — older readers ignore it.
    visionTokens: getVisionUsageTotal(),
    costUsd: costOf(totalUsage, getVisionUsageTotal()),
    toolCounts: totalToolCounts,
  });

  // Each model in the chain gets EXACTLY ONE attempt, then we advance to the next
  // (currently a SAME-MODEL re-roll: gemini-2.5-flash → gemini-2.5-flash; see
  // config.json llm.{model,fallbackModel}). If the last attempt also fails, the
  // scenario fails. WHY retry at all: the primary fails non-deterministically — an
  // intermittent EMPTY turn mid-flow from the thought-signature round-trip in
  // @langchain/google-genai 0.2.18 (no knob to disable thinking; the proper fix
  // needs a multi-major LangChain upgrade we're deliberately not doing for a hobby
  // harness). That empty turn is a per-attempt COIN FLIP, so a second roll of the
  // SAME proven model recovers it with high probability. WHY same-model (not an
  // independent fallback as before): we tried gemini-3-flash-preview here, but
  // Gemini 3 HARD-REQUIRES thought_signature round-tripping that 0.2.18 doesn't
  // forward, so every gemini-3 attempt 400s on its 2nd tool turn — an always-
  // failing fallback recovers nothing. 2.5-flash's signature requirement is SOFT,
  // so it's the only Gemini that both works on this binding and re-rolls the flake.
  // The chain is model-agnostic (just iterates whatever config lists), so this is a
  // pure config choice — swap fallbackModel to a different compatible model the
  // moment one exists. Deliberate FAIL verdicts short-circuit below (a real result,
  // never retried); only empty-turn / thrown outcomes fall through to the next
  // attempt.
  for (let i = 0; i < chain.length; i++) {
    globalAttempt += 1;
    // Attempt 1 inherits the orchestrator's pre-scenario reset; every later
    // attempt must re-establish a clean slate (prior attempt may have left the
    // app onboarded/with cues). See resetAppStateForRetry for the full why.
    if (globalAttempt > 1) resetAppStateForRetry(sink, globalAttempt);
    const outcome = await runOnce(
      chain[i],
      apiKey,
      scenario,
      cfg.appPackage,
      sink,
      globalAttempt,
    );
    totalStepsAcrossAttempts += outcome.steps;
    mergeMetrics(outcome);

    if (outcome.kind === "verdict") {
      // pass OR fail (deliberate FAIL from the agent) — done. Don't advance to
      // the next model on a deliberate FAIL: the scenario actually completed and
      // the agent judged it failed. That's a real result, not a model-capability
      // issue.
      const reason = `${outcome.reason}  [via model ${i + 1}/${chain.length}: ${chain[i]}]`;
      sink.finalize(outcome.verdict, reason, metaBlock());
      console.log(
        `[runner] ${outcome.verdict.toUpperCase()}: ${outcome.reason}`,
      );
      console.log(`[runner] metrics: ${metricsLine()}`);
      process.exit(outcome.verdict === "pass" ? 0 : 1);
    }

    // Non-verdict outcome (empty turn / thrown error): record it and advance to
    // the next model in the chain, if any. Both kinds advance identically now —
    // there is no same-model retry to skip, so `thrown` needs no special case.
    lastFailure = outcome;
    const why =
      outcome.kind === "noFinish"
        ? "no finish() called"
        : `error: ${outcome.error}`;
    const nextAction =
      i === chain.length - 1
        ? "no more models in chain — scenario fails"
        : "trying next model in chain";
    console.warn(
      `[runner] attempt ${globalAttempt} (model=${chain[i]}) failed (${why}); ${nextAction}`,
    );
    sink.log({
      kind: "thought",
      data: `[meta] attempt ${globalAttempt} failed: ${why}; ${nextAction}`,
    });
  }

  const summary =
    lastFailure?.kind === "thrown"
      ? `All ${chain.length} models errored. Last: ${lastFailure.error}`
      : `All ${chain.length} models ended without calling finish().`;
  sink.finalize("error", summary, metaBlock());
  console.error(`[runner] ERROR: ${summary}`);
  console.error(`[runner] metrics: ${metricsLine()}`);
  process.exit(1);
}

main();
