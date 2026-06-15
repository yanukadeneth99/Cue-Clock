// Writes per-run results into tests/ai/results/<timestamp>-<scenario>-<label>/.
// WHY one dir per run: makes it trivial to diff two runs of the same scenario,
//      and lets results/ stay flat-globbable.
// WHY jsonl trace: each step is one self-describing line; tail -f friendly,
//      survives a process crash mid-run (partial trace still parseable).
// WHY a final verdict.json: the orchestrator aggregates verdicts across all
//      runs into a single pass/fail without re-parsing prose.

import { mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Verdict = "pass" | "fail" | "error";

export type TraceEntry = {
  ts: string;             // ISO8601
  // "visual_checkpoint": one per-transition auto-check (autoVisual.ts) — its
  // geometry + vision report, recorded whether clean or defective so the trace
  // proves the screen was audited.
  kind: "thought" | "tool_call" | "tool_result" | "verdict" | "visual_checkpoint";
  data: unknown;
};

export class ResultsSink {
  readonly dir: string;
  private tracePath: string;

  constructor(rootDir: string, scenarioId: string, label: string) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    this.dir = join(rootDir, `${ts}-${scenarioId}-${label}`);
    mkdirSync(this.dir, { recursive: true });
    this.tracePath = join(this.dir, "trace.jsonl");
  }

  log(entry: Omit<TraceEntry, "ts">) {
    const line: TraceEntry = { ts: new Date().toISOString(), ...entry };
    appendFileSync(this.tracePath, JSON.stringify(line) + "\n");
  }

  finalize(verdict: Verdict, reason: string, meta: Record<string, unknown> = {}) {
    const payload = { verdict, reason, ...meta, finishedAt: new Date().toISOString() };
    writeFileSync(join(this.dir, "verdict.json"), JSON.stringify(payload, null, 2));
    this.log({ kind: "verdict", data: payload });
  }
}
