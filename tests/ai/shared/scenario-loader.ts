// Parses scenario markdown files into a structured object.
// WHY markdown: scenarios are authored by humans (or copy-pasted from bug reports)
//      and should be readable without a runner installed. The format below is
//      intentionally minimal so it's portable to web/iOS/desktop too.
//
// Expected file shape (sections are case-insensitive, order matters):
//
//   # Title (first H1 — used as scenario name)
//   ## Setup       — bullet list of preconditions (rendered into system prompt)
//   ## Steps       — bullet/numbered list of actions the agent should take
//   ## Expected    — bullet list of verifications the agent must perform
//   ## Verdict     — single sentence describing the pass criterion
//   ## Visual      — OPTIONAL. Layout-QA criteria + which screen state(s) to
//                    audit; when present the agent runs `visual_check` there and
//                    folds the findings into its verdict (see buildSystemPrompt).

import { readFileSync } from "node:fs";
import { basename } from "node:path";

export type Scenario = {
  id: string;       // derived from filename, used as results dir key
  name: string;     // human title from first H1
  setup: string;    // raw markdown block (preserve formatting for the LLM)
  steps: string;
  expected: string;
  verdict: string;
  // Optional visual-QA criteria. WHY optional: most functional scenarios don't
  // assert layout, and forcing a Visual block on them would add a paid vision
  // call + step for no reason. When present, the body lists what to eyeball and
  // at which screen state(s); the agent is instructed (see buildSystemPrompt) to
  // call `visual_check` there and fold the findings into its verdict. Absent ⇒
  // no visual checkpoint, behaviour unchanged.
  visual: string;
  // Optional per-scenario step ceiling. WHY optional + marker-based:
  // most scenarios are short atomic checks happy with the runner's default
  // MAX_STEPS (~40). A multi-phase JOURNEY scenario (decline onboarding → add
  // many cues → edit → fullscreen → settings → delete → reset) legitimately
  // needs 55-70 agent steps and would be killed mid-run by the default cap.
  // Declaring it inline keeps the budget next to the test it describes instead
  // of hard-coding scenario names in the runner. Undefined ⇒ runner default.
  maxSteps?: number;
  // Optional MECHANICAL end-state assertion(s). WHY this exists: `finish()`
  // reports the model's NARRATIVE, which can claim success the device never
  // reached — observed on fullscreen-cue, which passed while STILL stuck in the
  // On-Air view (a vision-estimated `press_xy` missed the small "Exit full
  // screen" pill; the near-miss only re-armed the pill's dim timer, never firing
  // onExit). Each `<!-- end-state-present: TEXT -->` marker names a substring
  // that MUST appear in an authoritative post-run snapshot; the runner overrides
  // a model PASS to FAIL if any is missing (see runner's end-state gate). Like
  // max-steps it's an HTML comment (metadata, not prose) so it stays out of the
  // rendered .md. Undefined/empty ⇒ no end-state gate, behaviour unchanged.
  endStatePresent?: string[];
};

export function loadScenario(path: string): Scenario {
  const raw = readFileSync(path, "utf8");

  // First H1 → name. Defensive: fall back to filename if author forgot.
  const h1 = raw.match(/^#\s+(.+)$/m);
  const name = h1 ? h1[1].trim() : basename(path, ".md");
  const id = basename(path, ".md");

  // Optional `<!-- max-steps: N -->` marker. WHY an HTML comment (not a
  // ## section): it's metadata ABOUT the test, not test content, so it stays
  // out of the human-readable prose and is invisible when the .md renders on
  // GitHub. Mirrors the `<!-- no-reset -->` convention test-all.sh anticipates.
  // Defensive parse: only accept a positive integer; anything else ⇒ undefined
  // so the runner falls back to its default cap rather than crashing on junk.
  const stepMatch = raw.match(/<!--\s*max-steps:\s*(\d+)\s*-->/i);
  const maxSteps = stepMatch ? Number.parseInt(stepMatch[1], 10) : undefined;

  // Optional `<!-- end-state-present: TEXT -->` markers (zero or more). Each is
  // a substring the post-run snapshot must contain. matchAll (global) so a
  // scenario can assert several tokens; trimmed + empties dropped so a stray
  // `<!-- end-state-present: -->` doesn't become an impossible "" requirement.
  const endStatePresent = [...raw.matchAll(/<!--\s*end-state-present:\s*(.+?)\s*-->/gi)]
    .map((m) => m[1].trim())
    .filter((s) => s.length > 0);

  return {
    id,
    name,
    setup: extractSection(raw, "Setup"),
    steps: extractSection(raw, "Steps"),
    expected: extractSection(raw, "Expected"),
    verdict: extractSection(raw, "Verdict"),
    visual: extractSection(raw, "Visual"),
    maxSteps: maxSteps && maxSteps > 0 ? maxSteps : undefined,
    endStatePresent: endStatePresent.length ? endStatePresent : undefined,
  };
}

// Pulls the body of `## <name>` up to the next `## ` or EOF.
// WHY non-greedy + multiline: section headers can repeat (e.g. nested ###) and
//      we only want the top-level `## ` boundaries.
// WHY `$(?![\\s\\S])` for EOF (NOT `\\Z`): `\\Z` is not a valid JS regex anchor —
//      the engine silently treats it as a literal "Z". With the old pattern the
//      EOF branch never fired, so the LAST `## ` section of every scenario (always
//      `## Verdict`) was dropped unless its text happened to contain a "Z". The
//      agent therefore never saw any Verdict. `$` (multiline) marks an end-of-line
//      position and the negative lookahead `(?![\\s\\S])` asserts nothing follows,
//      i.e. true end-of-string — the correct JS spelling of `\\Z`.
function extractSection(raw: string, name: string): string {
  const re = new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s+|$(?![\\s\\S]))`, "im");
  const m = raw.match(re);
  return m ? m[1].trim() : "";
}
