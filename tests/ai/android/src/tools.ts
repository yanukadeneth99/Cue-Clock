// LangChain tools wrapping the agent-device CLI.
// WHY exec-spawn per call (not a long-lived daemon client): agent-device already
//      maintains its own background daemon; the CLI is a thin RPC client so cold
//      invocation latency is ~50-150ms — acceptable for an LLM loop that's
//      bottlenecked by network round-trips to Gemini (~1-2s).
// WHY zod schemas: LangChain/LangGraph derive the Gemini functionDeclarations
//      from these directly. The descriptions ARE the agent's docstring; write
//      them like prompts, not like JSDoc.

import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
  parseRawSnapshot,
  analyzeGeometry,
  formatFindings,
  structureSignature,
  type VisualFinding,
} from "./visual.ts";

// --- core CLI runner -------------------------------------------------------

// Runs `agent-device <args>` and returns stdout. Throws on non-zero exit so
// LangGraph surfaces the error back to the LLM as a tool_call_error — the
// agent can then re-snapshot and retry instead of silently believing success.
export function run(args: string[], timeoutMs = 30_000): string {
  // Pin agent-device to a specific Android serial when AGENT_DEVICE_SERIAL is set
  // (physical-device mode). WHY this is REQUIRED, not optional:
  //   agent-device keeps a persistent daemon whose named "default" session BINDS
  //   to the first device it discovers and stays bound across runs. On a machine
  //   that previously drove an emulator, that binding sticks to the dead
  //   emulator-5554 — agent-device then re-targets (and even tries to re-boot)
  //   the ghost, ignoring ANDROID_SERIAL entirely. Passing --serial forces the
  //   session onto the real phone. The orchestrator runs `agent-device close`
  //   first so this serial cleanly (re)binds the session. Empty/unset (emulator
  //   mode) => no flag => agent-device's normal auto-discovery, unchanged.
  const serial = process.env.AGENT_DEVICE_SERIAL;
  const finalArgs = serial ? [...args, "--serial", serial] : args;
  const r = spawnSync("agent-device", finalArgs, {
    encoding: "utf8",
    timeout: timeoutMs,
    // Inherit PATH so the binary is found; explicitly forward GEMINI_API_KEY-less
    // env so we don't accidentally leak secrets into the agent-device daemon.
    env: { ...process.env },
  });
  if (r.status !== 0) {
    const tail = (r.stderr || r.stdout || "").trim().split("\n").slice(-20).join("\n");
    throw new Error(`agent-device ${args.join(" ")} failed (exit ${r.status}):\n${tail}`);
  }
  return (r.stdout || "").trim();
}

// Returns true if `packageName` currently owns the resumed (foreground) activity.
// WHY adb directly (not agent-device): agent-device has no "is X foreground?" query,
//      and we need a MODEL-INDEPENDENT guard against the open_app relaunch spiral
//      (see openAppTool). dumpsys' resumed-activity line is the OS's own source of
//      truth and is portable across Android 10-15 — grepping `ResumedActivity`
//      matches both `mResumedActivity` (API 29) and `topResumedActivity` (newer).
// WHY grep ON the device (quoted single shell arg): the full `dumpsys activity
//      activities` dump is multi-KB; pushing the grep into the device shell keeps
//      stdout to a couple of lines.
function isAppForeground(packageName: string): boolean {
  const serial = process.env.AGENT_DEVICE_SERIAL;
  const base = serial ? ["-s", serial] : [];
  const r = spawnSync(
    "adb",
    [...base, "shell", "dumpsys activity activities | grep -E ResumedActivity"],
    { encoding: "utf8", timeout: 8_000, env: { ...process.env } },
  );
  // adb hiccup / no match -> assume NOT foreground so the caller relaunches. Safe
  // default: a needless relaunch on the FIRST open is harmless (post-reset the app
  // is stopped anyway); wrongly skipping a real launch would strand the agent.
  if (r.status !== 0) return false;
  return (r.stdout || "").includes(packageName);
}

// Count the app-content @e refs in a snapshot tree, used as the "JS UI has
// mounted" signal by waitForAppReady. Exported so it can be unit-tested against
// real captured snapshots without a device. See the test for the exact splash
// vs. mounted trees this must discriminate.
//
// WHY we can't just count every @e ref: the Android software navigation bar
// (Back/Home/Recents soft keys) and the bare root [group] wrapper expose @e refs
// even while the app is STILL on the Expo splash. Observed on the Mi A2 Lite,
// the splash snapshot is exactly `@e1 [image] "Back"`, `@e2 [group]`,
// `@e3 [image] "Home"` — three refs of pure OS/structural chrome, zero app
// content. The old `match(/@e\d+/g).length` counted those as "mounted", so
// waitForAppReady returned during the splash, open_app reported "Opened" too
// early, and the model snapshotted an empty app → scroll → drift to launcher →
// relaunch spiral. So we count only refs that are neither a nav soft key nor a
// bare untyped group. Any real RN screen has at least one labelled/typed content
// ref beyond the nav bar, so the >= 1 gate still fires the instant the UI mounts.
export function countAppRefs(tree: string): number {
  const NAV_SOFTKEY = /\[image\] "(Back|Home|Recent|Recents|Overview)"$/;
  const BARE_GROUP = /^@e\d+ \[group\]$/;
  return tree
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        /@e\d+/.test(line) && !NAV_SOFTKEY.test(line) && !BARE_GROUP.test(line),
    ).length;
}

// Poll until the launched app's JS root has actually mounted, instead of
// blind-sleeping a fixed worst-case. WHY this replaces the old 40s setTimeout:
//   the activity becomes "resumed" (isAppForeground -> true) while the RN splash
//   is STILL up, so foreground alone is too early. The real mount signal is the
//   accessibility tree gaining interactive @e<id> refs — Expo's native splash
//   view exposes zero of them, the JS UI exposes many. We poll for that and
//   return the instant it's ready, so a phone that mounts in ~3s no longer eats
//   the full padding. The 40s ceiling stays ONLY as a safety floor for a genuine
//   slow/cold mount; in the common case we return ~10x faster.
//
// Stability gate: require two consecutive reads with refs present before
// declaring ready. WHY count-based (not tree-equality): the home screen's
// countdown text changes every second, so requiring an identical tree would
// never settle there — but the SET of interactive refs is stable across a tick,
// so "refs present twice in a row" cleanly means "past splash, not mid-transition".
async function waitForAppReady(
  packageName: string,
  maxMs: number,
): Promise<void> {
  const FLOOR_MS = 1_200; // let the activity start before the first poll
  const POLL_MS = 600;
  const deadline = Date.now() + maxMs;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  await sleep(FLOOR_MS);
  let readyHits = 0;
  while (Date.now() < deadline) {
    if (isAppForeground(packageName)) {
      let tree = "";
      try {
        tree = run(["snapshot", "-i", "-c"]);
      } catch {
        tree = ""; // snapshot can transiently fail mid-mount; treat as not-ready
      }
      if (countAppRefs(tree) >= 1) {
        readyHits += 1;
        if (readyHits >= 2) return; // mounted and stable -> done early
      } else {
        readyHits = 0;
      }
    }
    await sleep(POLL_MS);
  }
  // Timed out: fall through. The agent's next snapshot/screenshot still works;
  // worst case it sees splash and the foreground guard prevents a relaunch spiral.
}

// --- tools exposed to the LLM ---------------------------------------------

export const snapshotTool = tool(
  async ({ scope }: { scope?: string }) => {
    // -i: interactive elements only (filters out decorative nodes -> shorter tree)
    // -c: compact output (drops empty structural wrappers -> fewer tokens)
    // --scope @<ref>: zoom into a subtree once we know the parent
    const args = ["snapshot", "-i", "-c"];
    if (scope) args.push("--scope", scope);
    return run(args);
  },
  {
    name: "snapshot",
    description:
      "Return the current screen's accessibility tree (interactive elements only, compact). " +
      "Each tappable element is annotated with a stable @e<id> ref you MUST use for press/fill. " +
      "Optional `scope` zooms into a subtree (e.g. '@e12') — useful after big tree, before precision tap. " +
      "RULE: refs are invalidated after any mutating action (press, fill, type, back, scroll). Re-snapshot before the next press.",
    schema: z.object({
      // .optional() (NOT .nullish()). WHY this matters for Gemini: .nullish()
      // serializes to a JSON-Schema union `type: ["string","null"]`, but Gemini's
      // function_declarations proto treats `type` as a SCALAR — a union array is
      // rejected at the API with a hard 400 ("Proto field is not repeating") on the
      // FIRST call, before any step runs. .optional() serializes to a plain
      // `type: "string"`, which Gemini accepts. The handler treats falsy scope as
      // "full tree" (`if (scope)`), so an omitted arg is already handled.
      scope: z.string().optional().describe("Optional @ref to scope the snapshot to (e.g. '@e12')."),
    }),
  }
);

// --- vision sub-LLM (used by screenshotTool) ------------------------------
// WHY a separate lightweight client (not reusing the main agent's LLM):
//   The main agent runs through createReactAgent and has all the action tools
//   bound. We want a vanilla one-shot vision call here — no tools, no history,
//   just "describe this screen".
// WHY Gemini 2.5 Flash-Lite specifically: it's the cheapest vision describer
//   (~$0.002-0.005 per shot). For a 5-screenshot scenario the overhead is
//   ~$0.01-0.025 on top of the main loop. The describer is intentionally a
//   weaker/cheaper model than the agent's gemini-2.5-flash — describing one
//   static frame needs far less capability than driving the multi-turn loop.
let visionLLM: ChatGoogleGenerativeAI | null = null;
function getVisionLLM(): ChatGoogleGenerativeAI {
  if (!visionLLM) {
    visionLLM = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash-lite",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0,
      // Cap the description: it's a tool result the agent quotes back to itself
      // each subsequent step, so a long blob inflates every following prompt.
      maxOutputTokens: 400,
    });
  }
  return visionLLM;
}

// --- vision spend meter ----------------------------------------------------
// WHY a module-level accumulator (not threaded return values): EVERY flash-lite
// call funnels through getVisionLLM() — three sites today (screenshotTool, the
// auto-visual runVisionAudit, and the manual visual_check via the same). Their
// token usage lives on the invoke RESPONSE, NOT in the agent's LangGraph stream,
// so the runner's stream-based accounting never saw a single vision token and
// the printed cost silently omitted the entire (separately-priced) vision
// pipeline. Co-locating a meter here — where the spend happens — captures all
// three sites with one hook and gives the runner ONE number to read at the end.
// Process-scoped: the runner runs one scenario per process (attempts included),
// so this naturally totals the scenario's whole vision spend.
export type TokenUsage = { input: number; output: number; total: number };
const visionUsageTotal: TokenUsage = { input: 0, output: 0, total: 0 };
// Tally one vision response. We trust `total_tokens` (totalTokenCount) over the
// parts: Google's candidatesTokenCount EXCLUDES thinking tokens (and is known to
// under-report on flash-lite), while totalTokenCount includes everything — so
// `total - input` is the reliable billed-output figure the runner prices.
function addVisionUsage(resp: unknown): void {
  const um = (resp as { usage_metadata?: Record<string, number> })
    ?.usage_metadata;
  if (!um) return;
  visionUsageTotal.input += um.input_tokens ?? 0;
  visionUsageTotal.output += um.output_tokens ?? 0;
  visionUsageTotal.total += um.total_tokens ?? 0;
}
// Read the process-wide vision spend (a copy, so callers can't mutate the meter).
export function getVisionUsageTotal(): TokenUsage {
  return { ...visionUsageTotal };
}

export const screenshotTool = tool(
  async () => {
    // WHY a fresh tmpdir per shot: lets multiple parallel runners coexist (each
    // gets its own mkdtemp namespace) and lets the orchestrator grep the host
    // filesystem for forensic artifacts after a fail.
    const dir = mkdtempSync(join(tmpdir(), "cueclock-shot-"));
    const path = join(dir, "screen.png");
    // --no-stabilize: skip UIAutomator's waitForIdle() which deadlocks on
    // always-animating UIs like Cue Clock's home (ClockRail ticks every 1s).
    // This is the WHOLE POINT of this tool — `snapshot` cannot do this.
    run(["screenshot", path, "--no-stabilize"]);
    const buf = readFileSync(path);
    const b64 = buf.toString("base64");
    // Read the REAL pixel dimensions from the PNG IHDR chunk (width = bytes
    // 16-19, height = bytes 20-23, big-endian). WHY: the vision prompt used to
    // hard-code "typical Pixel emulator ~1080x2400", but the Mi A2 Lite is
    // 1080x2280. Anchoring the model to the actual frame stops it estimating in
    // the wrong coordinate space — the old guess made it place the pinned-bottom
    // "Add a cue" button at ~y=875 (mid-screen), so press_xy taps hit empty area.
    const shotW = buf.readUInt32BE(16);
    const shotH = buf.readUInt32BE(20);
    // WHY call vision LLM here (instead of returning the image to main agent):
    //   @langchain/google-genai converts ToolMessage to a Gemini functionResponse
    //   which is treated as JSON, not visual input. So image bytes in a tool
    //   result do NOT reach Gemini's vision system. Workaround: do the vision
    //   call here and return TEXT, which the tool-message pipeline handles
    //   natively. Phase 6.5 may rewrite the agent loop to inject HumanMessages
    //   with images directly — when/if vision-as-tool-text proves insufficient.
    const llm = getVisionLLM();
    const resp = await llm.invoke([
      new HumanMessage({
        content: [
          {
            type: "text",
            text:
              "Describe the visible Android UI for an automation agent. Format:\n" +
              "1. State: <1-line summary of which screen this is>\n" +
              "2. Modal: <if any modal/dialog is open, name it; else 'none'>\n" +
              "3. Tappable elements (each on its own line): <label> @ (x,y)\n" +
              `   Use absolute pixel coordinates measured from the top-left of ` +
              `the screen. The image is EXACTLY ${shotW}x${shotH} pixels — every ` +
              `coordinate MUST fall inside that range (x in 0..${shotW}, y in ` +
              `0..${shotH}). A pinned-bottom button (e.g. "Add a cue") sits near ` +
              `the very bottom, around y=${Math.round(shotH * 0.95)}, NOT mid-screen. ` +
              `Estimate centers, not exact.\n` +
              "Keep total under 600 chars. Do NOT speculate about elements you " +
              "can't see clearly.",
          },
          // The google-genai adapter accepts a raw data-URL string here and
          // converts it to inlineData under the hood. Verified empirically.
          { type: "image_url", image_url: `data:image/png;base64,${b64}` },
        ],
      }),
    ]);
    addVisionUsage(resp); // meter this flash-lite call (see visionUsageTotal)
    const desc =
      typeof resp.content === "string"
        ? resp.content
        : JSON.stringify(resp.content);
    return `[screenshot saved: ${path}]\n${desc}`;
  },
  {
    name: "screenshot",
    description:
      "Capture the current screen and return a textual description (state + modal + tappable elements with pixel coordinates). " +
      "USE THIS when `snapshot` times out (common on screens with always-running animations like a ticking clock). " +
      "Coordinates returned here are usable with `press_xy` (x,y) for tapping. " +
      "Costs an extra ~$0.003 per call vs `snapshot` — prefer `snapshot` when it works.",
    schema: z.object({}),
  }
);

export const pressXYTool = tool(
  async ({ x, y }: { x: number; y: number }) => {
    // `agent-device press <x> <y>` is the coordinate-based form. WHY a separate
    // tool from `press` (which takes a ref): mixing ref strings and coordinate
    // ints in one tool's schema confuses the LLM and produces malformed calls
    // (saw flash-lite send "press @e7 100" — an extra arg — when the schema
    // allowed both). Separate tools = unambiguous function declarations.
    return run(["press", String(x), String(y)]);
  },
  {
    name: "press_xy",
    description:
      "Tap by absolute pixel coordinates. USE THIS after `screenshot` when you don't have a ref. " +
      "Coordinates are top-left origin. After this returns, any prior @refs from snapshot are stale.",
    schema: z.object({
      x: z.number().int().describe("X pixel coordinate (top-left origin)."),
      y: z.number().int().describe("Y pixel coordinate (top-left origin)."),
    }),
  }
);

export const pressTool = tool(
  async ({ ref }: { ref: string }) => {
    const out = run(["press", ref]);
    return out || `pressed ${ref}`;
  },
  {
    name: "press",
    description:
      "Tap an element by its @e<id> ref obtained from a recent `snapshot`. " +
      "Triggers app-side handlers (navigation, modal open, button activation). " +
      "After this returns, all previous refs are stale — re-snapshot before the next press.",
    schema: z.object({
      ref: z.string().describe("The @e<id> ref of the element to tap, e.g. '@e7'."),
    }),
  }
);

export const fillTool = tool(
  async ({ ref, text }: { ref: string; text: string }) => {
    return run(["fill", ref, text]);
  },
  {
    name: "fill",
    description:
      "Tap a text input by its @ref and REPLACE its contents with `text`. " +
      "Combines focus + clear + type in one atomic action. " +
      "Do NOT use empty text to clear — find a clear button or report 'unsupported'.",
    schema: z.object({
      ref: z.string().describe("The @e<id> ref of the input field."),
      text: z.string().min(1).describe("Text to fill (non-empty)."),
    }),
  }
);

export const scrollTool = tool(
  async ({ direction }: { direction: "up" | "down" | "left" | "right" }) => {
    return run(["scroll", direction]);
  },
  {
    name: "scroll",
    description: "Scroll the focused list in the given direction by one screen.",
    schema: z.object({
      direction: z.enum(["up", "down", "left", "right"]),
    }),
  }
);

export const backTool = tool(
  async () => run(["back"]),
  {
    name: "back",
    description: "Navigate back (app-owned back button when available, else system back).",
    schema: z.object({}),
  }
);

export const openAppTool = tool(
  async ({ packageName, activity }: { packageName: string; activity?: string }) => {
    // GUARD: never relaunch an app that's already in the foreground.
    // WHY mechanical (not the prose "one-shot" rule in the system prompt): the
    //   model demonstrably IGNORES that rule — on the add-edit-delete-fullscreen
    //   journey gemini-2.5-flash called open_app at step 31 while a snapshot one
    //   step earlier clearly showed Cue Clock foreground. Because `open --relaunch`
    //   is kill-then-start, that wiped ALL 30 steps of progress (onboarding, add,
    //   edit) back to a fresh splash, which the model then mis-read as "stuck" and
    //   relaunched again — an unrecoverable spiral. Detecting foreground and
    //   refusing the relaunch breaks the loop AND preserves in-scenario state. The
    //   first open of each attempt still relaunches normally: post-reset the app is
    //   stopped, so isAppForeground() is false there.
    if (isAppForeground(packageName)) {
      return (
        `App ${packageName} is ALREADY open and in the foreground. Did NOT relaunch ` +
        `(a relaunch would reset all progress). Do NOT call open_app again — call ` +
        `\`snapshot\` (or \`screenshot\` on the ticking home screen) to see the current screen.`
      );
    }

    // --relaunch: kill-then-start so we always test from a known clean state
    const args = ["open", packageName, "--relaunch"];
    if (activity) args.push("--activity", activity);
    const out = run(args, 60_000);
    // WHY we wait at all: React Native debug builds spend ~3-10s on splash before
    // the JS root mounts (bundle fetch + parse + native module init). If the LLM's
    // first screenshot fires while splash is up, it concludes "stuck" and calls
    // open_app AGAIN — a relaunch spiral. We swallow the wait inside the tool so
    // the agent doesn't need a `wait` tool. But instead of a blind fixed sleep
    // (the old 40s — pure idle padding on a phone that mounts in ~3s), we POLL for
    // actual readiness and return the instant the JS UI is up. 40s is now only the
    // safety CEILING for a genuine slow/cold mount, not the every-time cost.
    // WHY not `agent-device wait`: traces showed it returning in ~9ms, i.e. it
    // does NOT block on this CLI/device — the awaited JS poll reliably does.
    await waitForAppReady(packageName, 40_000);
    return out;
  },
  {
    name: "open_app",
    description:
      "Launch (or relaunch) an Android app by package name. Use this once at the start of each scenario " +
      "to guarantee a known starting state. The optional `activity` is the fully-qualified component name " +
      "(e.g. 'com.example/.MainActivity') when the launcher activity isn't the default.",
    schema: z.object({
      packageName: z.string(),
      activity: z.string().optional(),
    }),
  }
);

// Per-attempt restart_app budget. WHY a hard cap: restart_app deliberately
// bypasses open_app's foreground guard, so a model that mis-reads a stuck screen
// can loop it indefinitely — each call is a heavy force-stop + relaunch + ~40s
// readiness wait (observed: a stuck edit-cue run fired restart_app 3× in a row,
// burning wall-clock and tokens while making zero progress). No legitimate
// scenario restarts more than once (only the persistence test restarts, exactly
// once), so >2 is always a spiral. The runner resets this counter at the start
// of every attempt via resetRestartBudget().
let restartCount = 0;
const MAX_RESTARTS = 2;
export function resetRestartBudget(): void {
  restartCount = 0;
}

export const restartAppTool = tool(
  async ({ packageName, activity }: { packageName: string; activity?: string }) => {
    // Spiral breaker: once the budget is spent, refuse further restarts and steer
    // the model to a terminal decision instead of letting it loop the heavy
    // force-stop/relaunch. It must either work with the current screen or finish.
    if (restartCount >= MAX_RESTARTS) {
      return (
        `restart_app BUDGET EXHAUSTED (${MAX_RESTARTS} restarts already used this ` +
        `attempt). Restarting again will NOT help — it only re-lands on the same ` +
        `screen. Do NOT call restart_app again. Take a fresh \`snapshot\`, work with ` +
        `the screen you have, or call \`finish\` with verdict 'fail' if you are truly stuck.`
      );
    }
    restartCount += 1;
    // Deliberate COLD RESTART: force-stop then relaunch UNCONDITIONALLY — it does
    // NOT consult isAppForeground(), unlike openAppTool.
    // WHY a separate tool instead of a flag on open_app: open_app's foreground
    //   guard exists to break the accidental-relaunch spiral (a model mis-reading
    //   splash as "stuck", relaunching, and wiping all in-scenario progress), so
    //   it MUST refuse to relaunch a foregrounded app. A persistence test needs
    //   the OPPOSITE — an intentional kill-then-start WHILE the app is foreground,
    //   to prove on-disk state rehydrates on a fresh process. The two intents are
    //   indistinguishable from the args alone, so we split them into two tools:
    //   open_app stays guarded (zero spiral-regression risk) and intent is now
    //   explicit at the call site. The model only reaches for restart_app when a
    //   scenario says "restart"/"relaunch".
    // NOTE: --relaunch is force-stop-then-start; it does NOT clear app data, so
    //   onboarding/cues/settings persist across it — exactly what's under test.
    const args = ["open", packageName, "--relaunch"];
    if (activity) args.push("--activity", activity);
    const out = run(args, 60_000);
    // Same readiness poll as open_app: RN debug builds spend ~3-13s on splash, so
    // return only once the JS UI is actually up (40s ceiling) — otherwise the
    // model's first post-restart screenshot catches splash and mis-reads "stuck".
    await waitForAppReady(packageName, 40_000);
    return out;
  },
  {
    name: "restart_app",
    description:
      "COLD-RESTART an already-running Android app: force-stop then relaunch, WITHOUT clearing its stored " +
      "data (onboarding, cues, and settings all persist across it). Use this ONLY when a scenario explicitly " +
      "asks to 'restart' or 'relaunch' the app — e.g. a persistence test verifying state survives a restart. " +
      "Unlike `open_app`, this deliberately relaunches even when the app is already in the foreground. Pass " +
      "the same `packageName` (and optional `activity`).",
    schema: z.object({
      packageName: z.string(),
      activity: z.string().optional(),
    }),
  }
);

export const appStateTool = tool(
  async () => run(["appstate"]),
  {
    name: "app_state",
    description:
      "Return the currently foreground app package and activity. Use this to verify the right app is on screen " +
      "before declaring a scenario passed or failed.",
    schema: z.object({}),
  }
);

// Terminal tool: the agent calls this when it's done. It does NOT execute on
// the device — it signals the LangGraph loop to halt with a verdict.
// WHY a tool (not just a final text message): function-call shape is structured
// JSON, which is far more reliable to parse than "did the model say PASS?".
export const finishTool = tool(
  async ({ verdict, reason }: { verdict: "pass" | "fail"; reason: string }) => {
    // This return is captured by the runner; the runner stops the loop on tool name.
    return JSON.stringify({ verdict, reason });
  },
  {
    name: "finish",
    description:
      "Call this exactly once when you are done — either you have verified all Expected outcomes (verdict: 'pass') " +
      "or you cannot complete the scenario (verdict: 'fail'). Include a one-sentence `reason`.",
    schema: z.object({
      verdict: z.enum(["pass", "fail"]),
      reason: z.string().min(1),
    }),
  }
);

// --- shared visual-QA primitives ------------------------------------------
// Both the manual `visual_check` tool AND the per-transition auto-checker
// (autoVisual.ts) drive the SAME two layers through these exported helpers, so
// there is ONE implementation of each layer and ONE vision prompt to keep
// honest. WHY split into two functions (geometry vs vision) rather than one
// combined report: the auto-checker needs the geometry result FIRST to compute
// the dedup signature and decide whether the (paid) vision call is even worth
// making — a combined helper would force the vision call every time.

// The vision describer's defect-hunting prompt. Shared verbatim so the manual
// checkpoint and every auto-checkpoint judge by identical criteria. Two clauses
// here are load-bearing under the "both HIGH hard-fail" policy:
//   - Keyboard occlusion: the soft keyboard is system UI (com.android.input*),
//     filtered out of the geometry layer by bundleId — so "is the focused input
//     hidden behind the keyboard?" can ONLY be caught by vision. This is the
//     exact case the user called out (input pushed up when the keyboard appears).
//   - By-design large fonts: Cue Clock's clock/countdown digits are big display
//     fonts on purpose. WITHOUT this guard the describer reads them as "oversized"
//     and, because vision HIGH now hard-fails, EVERY screen with a clock would
//     fail. This guard is what makes strict mode usable on this specific app.
export const AUTO_VISION_PROMPT =
  "You are a mobile UI visual-QA reviewer. Inspect ONLY for visual LAYOUT " +
  "DEFECTS — ignore whether the content is correct. Look for: text cut off / " +
  "truncated / ellipsized; text overflowing or spilling outside its container " +
  "or card; text that wrapped onto an extra line when it clearly shouldn't; " +
  "elements overlapping each other; text or buttons running off the screen " +
  "edges; font sizes that look too large or too small for their box; misaligned " +
  "or unevenly-spaced elements; unreadable contrast. " +
  "Keyboard occlusion — judge ONLY by what is actually visible, do NOT assume: " +
  "locate the focused input field and the TOP edge of the soft keyboard. Flag " +
  "HIGH ONLY if the input field is genuinely COVERED by the keyboard (they " +
  "overlap, with NO visible gap between the bottom of the input and the top of " +
  "the keyboard) or the input is pushed off the top of the screen. If there is " +
  "ANY visible gap between the input field and the keyboard, the input is NOT " +
  "occluded — that is CLEAN, do not flag it. The mere PRESENCE of a keyboard is " +
  "never a defect. " +
  "IMPORTANT: Cue Clock's clock times and countdown timers are LARGE single-line " +
  "display fonts BY DESIGN — do NOT flag the big clock/countdown digits as 'too " +
  "large' or oversized. " +
  "Reply with a short list, one defect per line as `SEVERITY: description` where " +
  "SEVERITY is HIGH or WARN. If the layout looks clean, reply EXACTLY `CLEAN`. Be " +
  "strict but do not invent issues you cannot clearly see. Keep under 500 chars.";

// (B) DETERMINISTIC geometry from `snapshot --raw` rects. Returns the findings,
// the formatted report, and the structure signature (for auto-check dedup) in
// one cheap, IO-bound, token-free call. Throws if the snapshot itself fails —
// callers degrade to "GEOMETRY: unavailable".
export function runGeometryReport(): {
  findings: VisualFinding[];
  report: string;
  signature: string;
} {
  const raw = run(["snapshot", "--raw"]);
  const { appPkg, nodes } = parseRawSnapshot(raw);
  const findings = analyzeGeometry(nodes, appPkg);
  return {
    findings,
    report: formatFindings(findings),
    signature: structureSignature(nodes, appPkg),
  };
}

// (A) VISION audit — screenshot the current screen and ask the cheap describer
// to hunt for layout defects (AUTO_VISION_PROMPT). Returns the raw describer
// text (e.g. "CLEAN" or "HIGH: ...\nWARN: ..."). Throws on capture/LLM failure —
// callers degrade to "VISION: unavailable".
export async function runVisionAudit(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "cueclock-vqa-"));
  const path = join(dir, "screen.png");
  run(["screenshot", path, "--no-stabilize"]);
  const b64 = readFileSync(path).toString("base64");
  const resp = await getVisionLLM().invoke([
    new HumanMessage({
      content: [
        { type: "text", text: AUTO_VISION_PROMPT },
        { type: "image_url", image_url: `data:image/png;base64,${b64}` },
      ],
    }),
  ]);
  addVisionUsage(resp); // meter this flash-lite call (see visionUsageTotal)
  return typeof resp.content === "string"
    ? resp.content.trim()
    : JSON.stringify(resp.content);
}

// Visual-QA checkpoint tool — combines the two complementary layers (geometry +
// vision) in ONE call so a manual checkpoint is a single step. WHY this still
// exists alongside the auto-checker: it's the model-visible, on-demand path
// (and the web runner's only path); the auto-checker is the mechanical guarantee.
// Both share the primitives above, so they always judge identically.
export const visualCheckTool = tool(
  async () => {
    // Geometry first — cheap and deterministic. Never let a vision hiccup hide a
    // hard geometry defect, so this runs independently of the screenshot.
    let geoReport: string;
    try {
      geoReport = runGeometryReport().report;
    } catch (e) {
      geoReport = `GEOMETRY: unavailable (${e instanceof Error ? e.message : String(e)})`;
    }

    let visionReport: string;
    try {
      visionReport = `VISION: ${await runVisionAudit()}`;
    } catch (e) {
      visionReport = `VISION: unavailable (${e instanceof Error ? e.message : String(e)})`;
    }

    return `${geoReport}\n${visionReport}`;
  },
  {
    name: "visual_check",
    description:
      "Audit the CURRENT screen for VISUAL LAYOUT defects (text truncation/overflow, " +
      "elements off-screen or overlapping, unexpected word-wrap, text too big/small, " +
      "misalignment). Returns a deterministic geometry report PLUS a vision review. " +
      "Call this at a Visual checkpoint declared in the scenario, while the screen to " +
      "audit is fully visible and settled. Then weigh the findings in your finish() " +
      "verdict per the scenario's Visual criteria (a HIGH finding usually means FAIL).",
    schema: z.object({}),
  }
);

export const ALL_TOOLS = [
  snapshotTool,
  screenshotTool,
  pressTool,
  pressXYTool,
  fillTool,
  scrollTool,
  backTool,
  openAppTool,
  restartAppTool,
  appStateTool,
  visualCheckTool,
  finishTool,
];
