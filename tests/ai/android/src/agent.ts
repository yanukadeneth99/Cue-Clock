// Builds the ReAct agent: Gemini 2.5 Flash + the agent-device tool set.
// WHY ChatGoogleGenerativeAI (not ChatOpenAI/OpenRouter shim): unlocks native
//      thinking-mode control + function-call shape, and avoids paying a markup.
// WHY createReactAgent: LangGraph ships a prebuilt loop (think -> tool -> observe
//      -> think) that handles tool dispatch, error propagation, and message
//      history. Rebuilding it would be ~150 lines of state machine for no gain.

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ALL_TOOLS } from "./tools.ts";
import {
  withAutoVisual,
  MUTATING_TOOL_NAMES,
  type AutoVisual,
} from "./autoVisual.ts";

export function buildSystemPrompt(scenario: {
  name: string;
  setup: string;
  steps: string;
  expected: string;
  verdict: string;
  visual?: string;
}, appPackage: string): string {
  // Only inject the visual-checkpoint machinery when the scenario actually
  // declares a `## Visual` block. WHY conditional: a functional-only scenario
  // shouldn't be told to run `visual_check` (it costs a vision call + a step and
  // would just add noise). When present, we (a) add a tool-discipline rule and
  // (b) append the criteria as their own section so Setup/Steps stay clean.
  const hasVisual = !!(scenario.visual && scenario.visual.trim());
  // WHY this rule changed from "call visual_check yourself" to "it's automatic":
  // the harness now runs the visual check MECHANICALLY after every action (see
  // autoVisual.ts) and ENFORCES the visual verdict itself — the model's job is
  // just to drive the steps. Telling the model to also call visual_check would
  // only duplicate work and reintroduce the prose-rule fragility we removed.
  const visualRule = hasVisual
    ? [
        `9. **VISUAL CHECKS ARE AUTOMATIC.** This scenario is in visual mode. After every action the harness`,
        `   audits the screen for layout defects on its own — you do NOT need to call \`visual_check\`. If a`,
        `   tool result ends with a "⚠ VISUAL DEFECT" line, a defect was detected; keep executing the steps`,
        `   normally and you MAY mention it in your final \`finish\` reason. The harness records every`,
        `   checkpoint and will FAIL the scenario on any HIGH visual defect regardless of your verdict, so`,
        `   focus on completing the functional steps correctly.`,
      ]
    : [];
  // WHY one big template: the LLM benefits from seeing the whole scenario at
  //      once (Setup informs Steps, Steps inform Expected). Splitting across
  //      turns burns tokens on repeating context.
  return [
    `You are an Android UI test agent. Your job is to execute a scripted scenario on a live emulator and report a verdict.`,
    ``,
    `## Target app`,
    `Package: \`${appPackage}\``,
    ``,
    `## Tool discipline (read carefully — most failures come from violating these)`,
    `1. ALWAYS call \`snapshot\` first to see what's on screen. Never guess refs.`,
    `2. Refs (\`@e<id>\`) are invalidated after ANY of: press, fill, scroll, back, open_app.`,
    `   You MUST call \`snapshot\` again before the next press/fill — old refs may tap wrong things.`,
    `2a. **NEVER press the same ref twice in a row without a \`snapshot\` in between.** After EVERY press,`,
    `    snapshot and CONFIRM the screen actually changed the way you intended (e.g. a stepper digit ticked`,
    `    up, a field gained focus). A control with a subtle effect — like a +/- time stepper — is the`,
    `    single biggest step-waster: do NOT blind-spam it. To bump a stepper by N, press ONCE, snapshot,`,
    `    read the new value, then decide whether one more press is needed. If two consecutive snapshots are`,
    `    IDENTICAL after a press, that ref is NOT working — STOP repeating it and try a different ref or`,
    `    \`press_xy\`, or re-read the tree for the correct control. Repeated identical presses on a stale ref`,
    `    are undefined (refs invalidate after each press) — they are not "the same action N times".`,
    `3. Use \`scope\` in snapshot to zoom into a known subtree when the full tree is noisy.`,
    `4. To clear a text field: tap a visible clear/x button. Never call \`fill\` with empty text.`,
    `5. When done, call \`finish\` exactly once with verdict 'pass' or 'fail' and a one-sentence reason. After \`finish\` returns, DO NOT call any more tools — the scenario is over.`,
    `6. Be efficient. Each tool call costs latency and tokens. Don't snapshot more than needed.`,
    `6a. **\`open_app\` is a ONE-SHOT** at the start of the scenario. NEVER call it a second time. If a`,
    `    screenshot shows a splash screen, that means the app is still loading — wait by calling`,
    `    \`screenshot\` again, do NOT relaunch. Splash can last 10-13s on older physical devices; the launch`,
    `    tool already waits 40s, so by the time open_app returns the home UI should be rendered. If you STILL`,
    `    see a splash, take ONE more screenshot and only then consider it stuck — do NOT relaunch.`,
    `6b. To DELIBERATELY restart the app (only when the scenario explicitly says "restart"/"relaunch", e.g. a`,
    `    persistence test), call \`restart_app\` — NOT a second \`open_app\`. \`restart_app\` force-stops and`,
    `    relaunches without clearing stored data, and is the ONLY sanctioned way to relaunch mid-scenario.`,
    `    \`open_app\` has no relaunch parameter; never try to pass one.`,
    `7. **PREFER \`snapshot\` + ref taps EVERYWHERE — including the home screen.** \`snapshot\` is reliable`,
    `   on this device and ref-based \`press\` is FAR more accurate than coordinate taps. ALWAYS call`,
    `   \`snapshot\` first and use its \`@e\` refs. The "Add a cue" button and every control you need are`,
    `   present in the snapshot tree.`,
    `7a. **PRESS BUTTONS BY THEIR LABEL, never by a guessed ref number.** When a step says to press a named`,
    `    control ("Continue", "OK", "Save changes", "Add cue"), read the snapshot and press the ref whose`,
    `    quoted label MATCHES that name — do NOT assume the button is \`@e14\` (or any particular number);`,
    `    refs are positional and shift every snapshot/scroll. If the named button is NOT in the current`,
    `    snapshot, it is off-screen: \`scroll\` down and re-\`snapshot\` until the labelled button appears,`,
    `    THEN press it. NEVER press a numerically-adjacent ref hoping it is the button — on modals like the`,
    `    "Android Setup" onboarding screen the other refs are deep-link rows ("Open app settings", "Open`,
    `    Other permissions") that LAUNCH a different app / background Cue Clock when tapped, which looks like`,
    `    a crash and wastes the whole run. The "Continue" button is at the BOTTOM (scroll-gated): scroll to`,
    `    it, confirm its label, then press.`,
    `8. **\`screenshot\` + \`press_xy\` is a LAST-RESORT FALLBACK, not a default.** Use it ONLY if \`snapshot\``,
    `   actually ERRORS (a timeout / "waitForIdle" failure from an always-running animation). Do NOT switch`,
    `   to screenshots pre-emptively just because a screen might animate — on this device \`snapshot\` does`,
    `   NOT time out on the home screen. When you DO fall back: \`press_xy\` coordinates from vision are only`,
    `   approximate (and least reliable near the top/bottom of tall screens — a pinned-bottom button sits`,
    `   near the very bottom edge, not mid-screen), so prefer a ref the moment \`snapshot\` works again.`,
    `9. **The Android OS TIME PICKER (clock dial) cannot be changed by tapping it.** When it appears, the`,
    `   snapshot shows ONLY the hour/minute digits as display-only \`[text]\` (e.g. "20"/"00"), a`,
    `   "Switch to text input mode for the time input." button, CANCEL, and OK — the round clock face and`,
    `   its draggable hand are NOT in the accessibility tree. Tapping the digit text, scrolling, or`,
    `   \`press_xy\` on the dial does NOTHING (the snapshot won't change), and a stale/duplicate tap can land`,
    `   on the system nav bar (the "Back"/"Home" nodes that appear in the SAME snapshot) and EXIT the app.`,
    `   So: if you only need the time shown, press OK. To CHANGE the time, FIRST press the`,
    `   "Switch to text input mode for the time input." button — that replaces the dial with editable`,
    `   Hour/Minute text fields — then \`fill\` the field with the new two-digit value. CRITICAL: \`fill\``,
    `   raises the soft keyboard, which OVERLAYS the dialog's OK/CANCEL buttons (they sit at the very bottom`,
    `   of the screen, exactly where the keyboard now is). If you press OK while the keyboard is up, your tap`,
    `   lands on the KEYBOARD instead — you'll suddenly see keyboard UI ("Open features menu", "does not`,
    `   support images here") and the time is NOT confirmed. So after filling you MUST press \`back\` ONCE to`,
    `   dismiss the keyboard, then re-\`snapshot\`, THEN press OK. Never tap the same ref twice or repeat an`,
    `   action that left the snapshot unchanged; re-snapshot and pick a different control instead.`,
    ...visualRule,
    ``,
    `## Scenario: ${scenario.name}`,
    ``,
    `### Setup (preconditions)`,
    scenario.setup || "_none_",
    ``,
    `### Steps (do these in order)`,
    scenario.steps,
    ``,
    `### Expected outcomes (verify ALL of these before passing)`,
    scenario.expected,
    ``,
    ...(hasVisual
      ? [
          ``,
          `### Visual criteria (audited automatically after every action; a matching HIGH finding ⇒ the harness FAILs the scenario)`,
          scenario.visual!.trim(),
        ]
      : []),
    ``,
    `### Pass criterion`,
    scenario.verdict,
  ].join("\n");
}

export type AgentBundle = ReturnType<typeof buildAgent>;

export function buildAgent(opts: {
  model: string;
  apiKey: string;
  maxOutputTokens?: number;
  // When provided (visual scenarios only), the mutating tools are wrapped so a
  // visual checkpoint fires after each one. Omitted ⇒ the plain tool set, zero
  // overhead for functional-only scenarios.
  av?: AutoVisual;
}) {
  // WHY no thinking control: @langchain/google-genai 0.2.18 (our pinned version)
  //      exposes NO thinking/reasoning field on its constructor input — verified
  //      against the installed dist .d.ts. A previous `thinkingBudget: 512` here
  //      was a SILENT NO-OP (unknown ctor field, dropped). Gemini 2.5 Flash runs
  //      thinking at its default (ON), which means it emits thought_signatures
  //      that must round-trip across turns; the binding doesn't always preserve
  //      them, producing intermittent EMPTY turns mid-flow ("no finish() called").
  //      Disabling thinking would need thinking_budget=0, only available after a
  //      multi-major upgrade (0.2.x → 2.1.x core/langgraph/genai in lockstep) we
  //      deliberately don't take for a hobby harness. The runner instead absorbs
  //      the coin-flip empty turn by retrying the scenario with the next entry in
  //      the model chain (currently a SAME-MODEL re-roll of gemini-2.5-flash; see
  //      runner.ts + config.json for why an independent gemini-3 fallback can't be
  //      used on this binding). Do NOT re-add a thinkingBudget field here until the
  //      package version actually supports it.
  // WHY maxOutputTokens 8192 (was 2048): for Gemini 2.5 this is the TOTAL output
  //      budget — thinking tokens AND the response SHARE it (unlike OpenAI, which
  //      bills reasoning separately). The model decides its own thinking depth, and
  //      on a deep turn it will happily spend the whole budget thinking, leaving
  //      ZERO for the function-call payload → Gemini returns finishReason=MAX_TOKENS
  //      with an empty candidate → the ReAct loop sees a no-tool-call message and
  //      ENDS ("no finish() called"). Observed exactly this on fullscreen-cue: both
  //      attempts executed every step correctly, then emitted an empty turn at the
  //      DEEPEST point (On-Air screenshot in context + 60-msg history) right before
  //      finish(). 2048 was fine for shallow turns but starved the verdict turn.
  //      8192 is Google's own recommended floor for thinking + output on 2.5-flash
  //      (the function-call payload is tiny; the headroom is for thinking to finish,
  //      NOT truncate). Raising the cap does NOT inflate cost on normal turns — the
  //      model only spends what it needs; it just stops truncating the deep ones.
  //      The proper alternative (thinking_budget=0) is unreachable in 0.2.18 — see
  //      the thinking-mode note above. Refs: googleapis/python-genai#782,
  //      valentinfrlch/ha-llmvision#609. This is NOT the max-steps cap.
  const llm = new ChatGoogleGenerativeAI({
    apiKey: opts.apiKey,
    model: opts.model,
    maxOutputTokens: opts.maxOutputTokens ?? 8192,
    temperature: 0,
  });
  // Wrap only the mutating tools when in visual mode; everything else passes
  // through untouched so the function declarations the agent sees are identical.
  const tools = opts.av
    ? ALL_TOOLS.map((t) =>
        MUTATING_TOOL_NAMES.has(t.name) ? withAutoVisual(t, opts.av!) : t,
      )
    : ALL_TOOLS;
  return createReactAgent({ llm, tools });
}
