// Per-transition visual auto-check (Android).
//
// WHY this exists: scenarios used to instruct the model to call `visual_check`
// once, at the end. The model demonstrably IGNORES prose checkpoint rules under
// step pressure — the SAME failure mode that forced the `open_app` relaunch
// guard to be mechanical rather than a prompt rule (see openAppTool). So visual
// coverage was never guaranteed, and transient states (an input while the soft
// keyboard is up) were never audited at all. This module makes the check
// MECHANICAL: after every settled UI transition, run the same two layers the
// manual `visual_check` tool runs (geometry + vision), record the checkpoint,
// and — because we chose "both HIGH hard-fail" — surface HIGH findings the
// runner folds into the verdict regardless of what the model concludes.
//
// WHY a tool WRAPPER (not the model calling a tool): the guarantee must not
// depend on the model. `withAutoVisual` wraps each mutating tool so the check
// fires from the harness side, invisibly to the agent's decision loop. The
// agent only ever SEES a one-line alert, and only when a defect is found.

import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { runGeometryReport, runVisionAudit } from "./tools.ts";
import type { ResultsSink } from "../../shared/results-writer.ts";

// Settle before capturing. WHY required (not optional): screenshots run with
// `--no-stabilize` (UIAutomator's waitForIdle deadlocks on the ticking clock),
// so nothing else waits for the transition to finish. Without this pause the
// check can catch a half-rendered, mid-animation frame and flag a phantom
// defect. 500ms comfortably clears a modal open / keyboard slide on the test
// devices while adding little to per-step wall time.
const DEFAULT_SETTLE_MS = 500;

export type VisualHigh = {
  checkpoint: number; // 1-based index among checkpoints that actually ran
  tool: string; // the mutating tool whose transition produced this state
  defects: string[]; // human-readable HIGH lines (geometry + vision)
};

// A vision describer line is a HIGH iff it starts with "HIGH" (case-insensitive),
// matching AUTO_VISION_PROMPT's "`SEVERITY: description`" contract.
function visionHighs(visionText: string): string[] {
  return visionText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.toUpperCase().startsWith("HIGH"));
}

export class AutoVisual {
  private readonly sink: ResultsSink;
  private readonly settleMs: number;
  private lastSignature: string | null = null;
  private ran = 0; // checkpoints that actually executed (after dedup)
  private readonly highs: VisualHigh[] = [];

  constructor(sink: ResultsSink, opts?: { settleMs?: number }) {
    this.sink = sink;
    this.settleMs = opts?.settleMs ?? DEFAULT_SETTLE_MS;
  }

  // Run a checkpoint after a mutating tool settled. Returns a one-line alert
  // string IFF a HIGH was found (the agent sees it appended to the tool result),
  // else null. NEVER throws — the auto-check is a passive observer and must not
  // break the functional step it rides on; on any failure it degrades to a
  // recorded "unavailable" and returns null.
  async afterTool(toolName: string): Promise<string | null> {
    await new Promise((r) => setTimeout(r, this.settleMs));

    // (B) Geometry — cheap, deterministic, AND the source of the dedup signature.
    let geoReport = "";
    let geoHighs: string[] = [];
    let signature: string | null = null;
    try {
      const g = runGeometryReport();
      geoReport = g.report;
      signature = g.signature;
      geoHighs = g.findings
        .filter((f) => f.severity === "high")
        .map((f) => `${f.kind}: ${f.detail}`);
    } catch (e) {
      // --raw can time out on the live-ticking fullscreen OnAirView (documented
      // expected behaviour). We lose dedup for this checkpoint but still let the
      // vision layer carry the audit, exactly like the manual tool does there.
      geoReport = `GEOMETRY: unavailable (${e instanceof Error ? e.message : String(e)})`;
    }

    // Dedup: identical structure to the last checkpoint ⇒ the screen didn't
    // really change ⇒ skip the PAID vision call entirely. Only when geometry
    // succeeded (a null signature means we couldn't measure, so we must not
    // treat two unmeasurable states as "the same").
    if (signature !== null && signature === this.lastSignature) {
      return null;
    }
    if (signature !== null) this.lastSignature = signature;

    // (A) Vision — the only layer that can see keyboard occlusion / oversized
    // fonts. Paid (~$0.003), so it runs only past the dedup gate.
    let visionText: string;
    let vHighs: string[] = [];
    try {
      visionText = await runVisionAudit();
      vHighs = visionHighs(visionText);
    } catch (e) {
      visionText = `unavailable (${e instanceof Error ? e.message : String(e)})`;
    }

    this.ran += 1;
    const defects = [...geoHighs, ...vHighs];

    // Record EVERY checkpoint (clean or not) for forensics — a clean trace is
    // proof the screen WAS audited, not skipped.
    this.sink.log({
      kind: "visual_checkpoint",
      data: {
        checkpoint: this.ran,
        afterTool: toolName,
        geometry: geoReport,
        vision: `VISION: ${visionText}`,
        high: defects,
      },
    });

    if (defects.length === 0) return null;

    this.highs.push({ checkpoint: this.ran, tool: toolName, defects });
    // The hybrid alert: the agent becomes aware of egregious issues without
    // being drowned in a CLEAN report every step.
    return (
      `⚠ VISUAL DEFECT (auto-check after ${toolName}): ${defects.join("; ")} ` +
      `— this will be recorded as a visual FAIL.`
    );
  }

  // All HIGH findings across the attempt. The runner forces the verdict to FAIL
  // when this is non-empty (overriding a model `pass`).
  getHighFindings(): VisualHigh[] {
    return this.highs;
  }
}

// Wrap a mutating tool so the auto-check fires after it. The agent calls the
// wrapped tool exactly as before; we run the inner tool, then the checkpoint,
// then append the alert (if any) to the tool result the agent reads next.
// WHY re-`tool()` (not mutate the original): keeps the original tool pristine
// for the manual path, and lets the same base tool be wrapped or not depending
// on whether the scenario opted into visual mode.
export function withAutoVisual(
  base: StructuredToolInterface,
  av: AutoVisual,
): StructuredToolInterface {
  return tool(
    async (args: unknown) => {
      const out = await base.invoke(args as never);
      const alert = await av.afterTool(base.name);
      const outStr = typeof out === "string" ? out : JSON.stringify(out);
      return alert ? `${outStr}\n${alert}` : outStr;
    },
    {
      name: base.name,
      description: base.description,
      // base.schema is the original zod schema; reuse it verbatim so the Gemini
      // function declaration is byte-identical to the unwrapped tool.
      schema: base.schema,
    },
  ) as StructuredToolInterface;
}

// The mutating/navigating tools whose transitions warrant a visual checkpoint.
// Read-only tools (snapshot, screenshot, app_state, visual_check, finish) are
// NOT wrapped — they don't change the screen, so checking after them is pure
// cost. open_app IS included: the check then lands on the settled home screen
// (the initial-state checkpoint).
export const MUTATING_TOOL_NAMES = new Set([
  "press",
  "press_xy",
  "fill",
  "scroll",
  "back",
  "open_app",
]);
