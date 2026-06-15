"""
Web scenario runner: browser-use + Gemini 2.5 Flash.

WHY a separate Python runner (not unifying with the TS Android one):
    browser-use is Python-only and is *the* battle-tested browser harness for
    LLM agents (95k stars, Playwright-backed). Re-implementing its perception
    + tool layer in TS would be weeks of work for zero functional gain.

Usage:
    uv run python runner.py <scenario.md> [--label web]

Assumes:
    - GEMINI_API_KEY in tests/ai/.env (loaded explicitly below)
    - The target URL (Expo web dev server, or any URL the scenario opens)
      is reachable at the time of run. Runner does NOT boot the dev server —
      that's the orchestrator's job (Phase 4) to keep this composable.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Resolve the harness root regardless of CWD so dotenv + config + results all
# land in deterministic locations even when invoked by the orchestrator.
HARNESS_DIR = Path(__file__).resolve().parent.parent  # tests/ai/
WEB_DIR = Path(__file__).resolve().parent  # tests/ai/web/
load_dotenv(HARNESS_DIR / ".env")

# The deterministic geometry probe (Approach B). Loaded ONCE at import: it's a
# static asset shipped into the page via CDP Runtime.evaluate on each
# visual_check call, the web analog of the Android runner's visual.ts. Keeping
# it in its own .js file (not a Python string) keeps it lintable/editable.
PROBE_JS = (WEB_DIR / "visual_probe.js").read_text(encoding="utf-8")

# Scrub browser-use's own highlight overlays from the DOM right before an audit
# screenshot, so the vision describer sees ONLY the app — never the harness's
# annotations. WHY this is needed: after a click/type, browser-use paints a
# transient orange "interaction highlight" (animated corner brackets, tagged
# `data-browser-use-interaction-highlight`) that lives for `interaction_highlight_
# duration` (default 1.0s). browser-use's built-in remove_highlights() only clears
# the PERCEPTION overlay (`data-browser-use-highlight`) — a DIFFERENT attribute —
# so the brackets survive into our screenshot, which the auto-check fires only
# WEB_SETTLE_S (0.4s) after the step, well inside the 1.0s bracket lifetime. An
# L-shaped corner bracket is geometrically identical to a clipped border, so the
# flash-lite describer reports a phantom "edge cut off" HIGH while the deterministic
# geometry probe stays CLEAN — a recurring false-FAIL (e.g. delete-cue-web cp5 right
# after typing the cue name, 2026-06-15). Removing the overlay node here is race-free,
# unlike widening WEB_SETTLE_S past the highlight's fade (which reintroduces a timing
# dependency). Covers both overlay attributes + the debug container id so any
# browser-use highlight variant is stripped.
SCRUB_OVERLAYS_JS = (
    "(function(){"
    "document.querySelectorAll("
    "'[data-browser-use-highlight],[data-browser-use-interaction-highlight]'"
    ").forEach(function(el){el.remove();});"
    "var c=document.getElementById('browser-use-debug-highlights');"
    "if(c)c.remove();"
    "return true;"
    "})();"
)

# Imported AFTER load_dotenv so browser-use's lazy provider init picks up the key.
from browser_use import Agent, ActionResult, BrowserProfile, Tools  # noqa: E402
from browser_use.llm import ChatGoogle  # noqa: E402
from browser_use.llm.messages import (  # noqa: E402
    ContentPartImageParam,
    ContentPartTextParam,
    ImageURL,
    UserMessage,
)


def parse_scenario(path: Path) -> dict[str, str]:
    """Mirror of shared/scenario-loader.ts in Python. Single format across runners."""
    raw = path.read_text(encoding="utf-8")
    h1 = re.search(r"^#\s+(.+)$", raw, re.MULTILINE)
    name = h1.group(1).strip() if h1 else path.stem

    def section(label: str) -> str:
        # WHY \Z fallback: last section has no following `## ` boundary.
        m = re.search(
            rf"^##\s+{label}\s*$([\s\S]*?)(?=^##\s+|\Z)",
            raw,
            re.MULTILINE | re.IGNORECASE,
        )
        return m.group(1).strip() if m else ""

    return {
        "id": path.stem,
        "name": name,
        "setup": section("Setup"),
        "steps": section("Steps"),
        "expected": section("Expected"),
        "verdict": section("Verdict"),
        # Optional layout-QA criteria. Absent ⇒ "" ⇒ no visual checkpoint
        # injected, behaviour unchanged. Mirrors scenario-loader.ts's `visual`.
        "visual": section("Visual"),
    }


def build_task(scenario: dict[str, str]) -> str:
    """
    The full scenario as a single task string — browser-use Agent's contract.

    WHY one big task (not a tool-driven multi-message loop): browser-use's
    internal prompt already orchestrates the ReAct cycle; our job is just to
    state the *what*. Splitting it would fight the framework.
    """
    # Only inject the visual-checkpoint machinery when the scenario declares a
    # `## Visual` block — mirrors buildSystemPrompt's `hasVisual` gate on the
    # Android side. A functional-only scenario shouldn't be told to run
    # visual_check (it costs a geometry+vision call for no reason).
    has_visual = bool(scenario.get("visual", "").strip())
    visual_block = [
        "",
        "## Visual criteria (audited automatically after every step; a matching "
        "HIGH finding ⇒ the harness FAILs the scenario)",
        scenario["visual"].strip(),
        "",
        "VISUAL INSTRUCTIONS: visual checks run AUTOMATICALLY after every step in "
        "this scenario — you do NOT need to call the `visual_check` tool. The "
        "harness audits each page for layout defects on its own and will FAIL the "
        "scenario on any HIGH defect regardless of your summary, so focus on "
        "completing the functional steps correctly. You MAY still call "
        "`visual_check` once at the key state if you want to see the report and "
        "mention a specific defect in your PASS:/FAIL: summary.",
    ] if has_visual else []

    return "\n".join([
        f"# Scenario: {scenario['name']}",
        "",
        "## Setup (preconditions)",
        scenario["setup"] or "_none_",
        "",
        "## Steps (in order)",
        scenario["steps"],
        "",
        "## Expected (verify ALL before declaring success)",
        scenario["expected"],
        *visual_block,
        "",
        "## Pass criterion",
        scenario["verdict"],
        "",
        "When finished, return a one-line summary starting with PASS: or FAIL:.",
    ])


# Vision-pass prompt — kept verbatim in spirit with the Android tool's
# AUTO_VISION_PROMPT so both runners hunt for the SAME subjective defects
# geometry can't quantify. Two clauses are load-bearing under "both HIGH
# hard-fail":
#   - Sticky-overlay occlusion: the web analog of Android's keyboard-occlusion
#     clause. Desktop web has no soft keyboard, but a position:fixed/sticky
#     header or toast can still hide content — geometry can't judge "is X hidden
#     behind Y", so the vision layer must. BUT a modal/dialog/sheet covering the
#     page behind it is its JOB, not a defect — see the "expected overlay" guard.
#   - By-design large fonts: Cue Clock's clock/countdown digits are big display
#     fonts on purpose. WITHOUT this guard the describer reads them as "oversized"
#     and, because vision HIGH now hard-fails, EVERY screen with a clock fails.
#   - Anti-hallucination guards: the describer (flash) over-reports on clean pages
#     — inventing "cut off" icons and "insufficient padding" where none exist.
#     Because vision HIGH hard-fails, every false positive flakes a real test, so
#     the prompt now forbids inferring clipping from spacing and demotes
#     padding/alignment aesthetics to WARN. (Observed: add-cue FAILed on a pristine
#     final screen because flash claimed the delete icon was clipped — it wasn't.)
# The VISION describer model — DELIBERATELY decoupled from the agent's llm.model
# chain and hardcoded to flash-lite, matching the Android runner (android/src/
# tools.ts). WHY not the agent model (flash): an A/B on known-CLEAN screenshots
# showed flash-lite returns CLEAN reliably (3/3) while the bigger gemini-2.5-flash
# HALLUCINATES "text/icon clipped" HIGH findings on the SAME clean images (3/3) —
# the larger model over-reports clipping and, because vision HIGH hard-fails, it
# flunked clean runs. flash-lite is the accurate describer here AND is cheaper
# (priced via config.json `visionPricing`). Swap only after re-running that A/B.
VISION_MODEL = "gemini-2.5-flash-lite"


VISION_PROMPT = (
    "You are a web UI visual-QA reviewer. Inspect ONLY for visual LAYOUT DEFECTS "
    "— ignore whether the content is correct. Flag HIGH ONLY for defects you can "
    "UNAMBIGUOUSLY SEE: text or an icon visibly sliced off at a container/viewport "
    "edge (a literal cut, with an ellipsis or a chopped glyph — NOT merely 'close "
    "to the edge'); text spilling outside its card; two elements clearly drawn on "
    "top of each other; content running off the screen edge. "
    "A MODAL, DIALOG, or first-run SHEET (e.g. an analytics consent sheet or an "
    "'Add a cue' editor) covering the page behind it is EXPECTED — that is what a "
    "modal does. Do NOT flag the background clocks/cards being hidden by a modal; "
    "only flag occlusion when a NON-modal sticky/fixed header or toast hides "
    "content the user needs, OR when the modal's OWN content is clipped/overflowing. "
    "IMPORTANT: Cue Clock's clock times and countdown timers are LARGE single-line "
    "display fonts BY DESIGN — do NOT flag the big clock/countdown digits as 'too "
    "large' or oversized. "
    "Do NOT infer clipping from tight spacing, and do NOT report padding, margin, "
    "or minor alignment/spacing complaints as HIGH — those are WARN at most. When "
    "in doubt, it is NOT a HIGH. "
    "Reply with a short list, one defect per line as `SEVERITY: description` where "
    "SEVERITY is HIGH or WARN. If the layout looks clean, reply EXACTLY `CLEAN`. "
    "Be strict but NEVER invent issues you cannot clearly see. Keep under 500 chars."
)


# Vision findings that assert a GEOMETRIC defect — clipping, slicing, truncation,
# overflow, content off-screen. The deterministic geometry probe (visual_probe.js)
# is the AUTHORITY on exactly these: it measures viewport overflow and text
# truncation (scrollWidth > clientWidth + a clip style) precisely. The flash-lite
# describer, by contrast, is documented to HALLUCINATE this defect class on clean
# screens (see the VISION_PROMPT notes; observed: "trash icon clipped at card edge"
# and "settings text cut off at modal bottom" on pristine, geometry-CLEAN frames).
# So a clipping-class vision HIGH only counts toward the hard-fail gate when the
# geometry layer ALSO flagged a HIGH at the same checkpoint (corroboration). This
# assigns authority by defect TYPE to the layer that can actually measure it, which
# kills the recurring phantom-clip false-FAILs without weakening detection of REAL
# geometric clips (geometry still hard-fails those) or of NON-geometric vision
# defects (occlusion by a sticky header, bad contrast, two real elements overlapping
# — vision's own domain, always hard-fail).
_CLIP_CLASS_RE = re.compile(
    r"clip|cut[\s-]?off|cut\s+off|slic|truncat|off[\s-]?screen|overflow|"
    r"past the edge|chopp|sliced",
    re.IGNORECASE,
)


def is_clip_class(finding: str) -> bool:
    """True if a vision finding is a GEOMETRIC (clipping/overflow) claim — the
    class the deterministic geometry probe owns and the describer over-reports."""
    return bool(_CLIP_CLASS_RE.search(finding))


def gate_highs(geo_highs: list[str], vis_highs: list[str]) -> tuple[list[str], list[str]]:
    """Split the checkpoint's HIGH findings into (gating, demoted). Geometry HIGHs
    always gate. A vision HIGH gates unless it is clipping-class AND geometry did
    NOT corroborate it this checkpoint — those are demoted to WARN (recorded in the
    trace for triage, but they do NOT fail the run). See _CLIP_CLASS_RE above."""
    geo_corroborates = bool(geo_highs)
    demoted = [h for h in vis_highs if is_clip_class(h) and not geo_corroborates]
    gating = [h for h in (geo_highs + vis_highs) if h not in demoted]
    return gating, demoted


def format_geometry(value: object) -> str:
    """Render the probe's JSON into the same report shape as the Android tool's
    formatFindings, so verdict traces read identically across runners."""
    if not isinstance(value, dict):
        return "GEOMETRY: unavailable (probe returned no object)"
    if value.get("error"):
        return f"GEOMETRY: unavailable (probe error: {value['error']})"
    findings = value.get("findings") or []
    if not findings:
        return "GEOMETRY: clean — no layout defects detected."
    counts: dict[str, int] = {}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1
    head = (
        f"GEOMETRY: {counts.get('high', 0)} high, "
        f"{counts.get('warn', 0)} warn, {counts.get('info', 0)} info"
    )
    lines = [f"  [{f['severity'].upper()}] {f['kind']}: {f['detail']}" for f in findings]
    return "\n".join([head, *lines])


# Settle before an auto-checkpoint captures. WHY: browser-use advances to the
# next step as soon as its action completes, but a click that opens a modal or
# focuses an input may still be animating. A short pause lets the layout settle
# so the probe + screenshot see the final frame, not a mid-transition one. Web
# transitions are faster than Android's, so 0.4s suffices.
WEB_SETTLE_S = 0.4


async def web_geometry(browser_session) -> dict:
    """(B) DETERMINISTIC geometry: ship visual_probe.js into the page via CDP
    Runtime.evaluate and read back its rects. Returns the formatted report, the
    structure-only dedup signature, and the HIGH findings. Never raises — on any
    failure it degrades to a 'GEOMETRY: unavailable' report with no signature
    (so the caller cannot mistake an unmeasurable state for an unchanged one)."""
    try:
        cdp = await browser_session.get_or_create_cdp_session()
        res = await cdp.cdp_client.send.Runtime.evaluate(
            params={"expression": PROBE_JS, "returnByValue": True, "awaitPromise": True},
            session_id=cdp.session_id,
        )
        value = (res.get("result") or {}).get("value")
        report = format_geometry(value)
        signature = value.get("signature") if isinstance(value, dict) else None
        highs = []
        if isinstance(value, dict):
            for f in value.get("findings") or []:
                if f.get("severity") == "high":
                    highs.append(f"{f['kind']}: {f['detail']}")
        return {"report": report, "signature": signature, "highs": highs}
    except Exception as e:  # noqa: BLE001 — degrade, never crash the step
        return {"report": f"GEOMETRY: unavailable ({e!r})", "signature": None, "highs": []}


async def web_vision(browser_session, vision_llm: ChatGoogle, results_dir: Path,
                     shot_counter: dict, vision_usage: dict | None = None) -> dict:
    """(A) VISION audit: CDP screenshot → the describer model with the
    defect-hunting prompt. Returns the describer text + its HIGH lines. Never
    raises — degrades to 'unavailable'. A describer line is HIGH iff it starts
    with 'HIGH' (matching VISION_PROMPT's `SEVERITY: description` contract).

    WHY vision_usage accumulator: the describer is a SEPARATE model from the
    agent, billed at its own (cheaper) rate, and it runs on every checkpoint —
    so its tokens are real spend that must be counted into verdict.json's cost.
    The agent's token_cost_service does NOT see these direct ainvoke() calls, so
    we tally them here. Mutated in place across every call so the totals survive
    the per-attempt Agent rebuilds."""
    try:
        shot_counter["n"] += 1
        shot_path = results_dir / f"visual-{shot_counter['n']}.png"
        # Strip browser-use's highlight overlays so the describer audits the app,
        # not the harness's interaction brackets (see SCRUB_OVERLAYS_JS). Best-effort:
        # a scrub failure must never block the screenshot — worst case is the old
        # behaviour, not a crashed checkpoint.
        try:
            cdp = await browser_session.get_or_create_cdp_session()
            await cdp.cdp_client.send.Runtime.evaluate(
                params={"expression": SCRUB_OVERLAYS_JS, "returnByValue": True},
                session_id=cdp.session_id,
            )
        except Exception:  # noqa: BLE001 — scrub is advisory; screenshot proceeds regardless
            pass
        png = await browser_session.take_screenshot(path=str(shot_path))
        b64 = base64.b64encode(png).decode("ascii")
        msg = UserMessage(content=[
            ContentPartTextParam(text=VISION_PROMPT),
            ContentPartImageParam(
                image_url=ImageURL(
                    url=f"data:image/png;base64,{b64}", media_type="image/png"
                )
            ),
        ])
        out = await vision_llm.ainvoke([msg])
        # Tally describer token usage (ChatInvokeCompletion.usage may be None on
        # a degraded turn — guard each field with `or 0`).
        if vision_usage is not None and getattr(out, "usage", None) is not None:
            u = out.usage
            vision_usage["input"] += u.prompt_tokens or 0
            vision_usage["output"] += u.completion_tokens or 0
            vision_usage["total"] += u.total_tokens or 0
        desc = out.completion if isinstance(out.completion, str) else str(out.completion)
        desc = desc.strip()
        highs = [ln.strip() for ln in desc.split("\n") if ln.strip().upper().startswith("HIGH")]
        return {"text": desc, "highs": highs}
    except Exception as e:  # noqa: BLE001
        return {"text": f"unavailable ({e!r})", "highs": []}


def build_visual_tools(vision_llm: ChatGoogle, results_dir: Path,
                       shot_counter: dict, vision_usage: dict) -> Tools:
    """
    Register the `visual_check` custom action — the web analog of the Android
    runner's visualCheckTool. Combines the two layers (web_geometry + web_vision)
    in ONE call so a manual checkpoint is a single step. WHY this still exists
    alongside the per-step auto-check hook: it's the model-VISIBLE path (the hook
    is out-of-band on web — see make_on_step_end), and both share the helpers so
    they judge identically. shot_counter is shared so manual + auto screenshots
    number into one sequence.
    """
    tools = Tools()

    @tools.action(
        "Audit the CURRENT web page for VISUAL LAYOUT defects (text "
        "truncation/overflow, elements off-screen or overlapping, unexpected "
        "word-wrap, text too big/small, misalignment). Returns a deterministic "
        "geometry report PLUS a vision review. Call this at a Visual checkpoint "
        "declared in the scenario, once the page to audit is fully visible and "
        "settled, then weigh the findings in your PASS/FAIL summary per the "
        "scenario's Visual criteria (a HIGH finding usually means FAIL)."
    )
    # NOTE: `browser_session` is intentionally UNANNOTATED. This module uses
    # `from __future__ import annotations`, which stringizes every annotation;
    # browser-use validates special-injected params by comparing the annotation
    # to the real `BrowserSession` class at registration, and a string `'Browser
    # Session'` fails that check (its own built-in actions don't use the future
    # import, so they're unaffected). The framework injects this param BY NAME, so
    # dropping the annotation is correct and keeps registration working.
    async def visual_check(browser_session) -> "ActionResult":  # noqa: ANN001
        geo = await web_geometry(browser_session)
        vis = await web_vision(browser_session, vision_llm, results_dir, shot_counter, vision_usage)
        report = f"{geo['report']}\nVISION: {vis['text']}"
        # include_in_memory: the agent must SEE the report on its next step to fold
        # it into the verdict — otherwise the checkpoint result is invisible to it.
        return ActionResult(extracted_content=report, include_in_memory=True)

    return tools


async def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("scenario", help="path to scenario .md")
    p.add_argument("--label", default="web", help="results-dir label")
    # Cap at 20: observed passing scenarios use 4-9 steps. 20 caps cost on a
    # runaway loop at ~$0.08 (flash-lite). Bumping requires conscious decision.
    p.add_argument("--max-steps", type=int, default=20)
    args = p.parse_args()

    scenario = parse_scenario(Path(args.scenario).resolve())
    cfg = json.loads((HARNESS_DIR / "config.json").read_text())

    # Results dir mirrors the TS runner's naming so the orchestrator can glob
    # both without per-runner special-casing.
    ts = datetime.now(timezone.utc).isoformat().replace(":", "-").replace(".", "-")
    # WHY RESULTS_BASE override: the orchestrator (test-all.sh) groups every
    # scenario in one invocation under run-<ts>/. Honoring the env var lets
    # the runner stay composable (works standalone) while also slotting into
    # the orchestrator's layout when invoked from there.
    import os
    results_base = Path(os.environ.get("RESULTS_BASE", str(HARNESS_DIR / "results")))
    results_dir = results_base / f"{ts}-{scenario['id']}-{args.label}"
    results_dir.mkdir(parents=True, exist_ok=True)

    # Model fallback chain: primary → fallbackModel → lastResortModel.
    # WHY filter None: absent fallback keys shouldn't trigger empty attempts.
    chain = [cfg["llm"].get("model"),
             cfg["llm"].get("fallbackModel"),
             cfg["llm"].get("lastResortModel")]
    chain = [m for m in chain if m]

    print(f"[runner] scenario={scenario['id']} label={args.label}")
    print(f"[runner] model chain: {' -> '.join(chain)}")
    print(f"[runner] results -> {results_dir}")

    # Visual-QA tool. Registered for EVERY web scenario (parity with the Android
    # runner, where visual_check is always in ALL_TOOLS); the agent only calls it
    # when build_task injects the Visual instructions, i.e. when the scenario
    # declares a `## Visual` block. WHY VISION_MODEL (flash-lite) and NOT the
    # agent's chain[0] (flash): a single image-describe isn't the multi-turn
    # function-calling loop that degrades lite models on the AGENT side, and the
    # A/B in VISION_MODEL's comment proved flash-lite is the ACCURATE describer
    # here while flash hallucinates clipping. Built once, reused across attempts.
    vision_llm = ChatGoogle(model=VISION_MODEL, temperature=0)
    # shot_counter shared across the manual tool AND the auto-check hook so all
    # screenshots number into one visual-N.png sequence in the results dir.
    shot_counter = {"n": 0}
    # Token tallies. `vision_usage` collects the describer's spend (separate model,
    # separate rate) across BOTH the manual tool and the per-step hook; it survives
    # the per-attempt Agent rebuilds. Agent tokens are read from each attempt's
    # token_cost_service and summed into `agent_usage` inside the loop below.
    vision_usage = {"input": 0, "output": 0, "total": 0}
    agent_usage = {"input": 0, "output": 0, "total": 0}
    tools = build_visual_tools(vision_llm, results_dir, shot_counter, vision_usage)

    # Per-transition visual auto-check (the web analog of the Android tool
    # wrapper). browser-use owns its ReAct loop, so we can't wrap individual
    # tools; instead we hook the STEP boundary via Agent.run(on_step_end=...).
    # After each step we run the same two layers and record HIGH findings
    # out-of-band. WHY out-of-band (not injected into the agent like Android's
    # inline alert): on_step_end returns None and has no clean API to add to the
    # agent's next-step context without poking browser-use internals — so the
    # GUARANTEE (hard-fail) lives here, and the model-visible path stays the
    # manual `visual_check` tool. Gated on has_visual: zero cost otherwise.
    has_visual = bool(scenario.get("visual", "").strip())
    # Reset per attempt (a retry re-runs the whole scenario = a fresh timeline).
    collector = {"last_sig": None, "ran": 0, "checkpoints": [], "highs": []}

    def make_on_step_end():
        async def on_step_end(agent) -> None:
            # MUST NOT raise — an exception here would abort the agent's step.
            try:
                await asyncio.sleep(WEB_SETTLE_S)
                geo = await web_geometry(agent.browser_session)
                sig = geo["signature"]
                # Dedup: unchanged structure ⇒ skip the paid vision call. Only
                # when we actually measured a signature (None ⇒ unmeasurable, so
                # don't treat two unmeasurable states as identical).
                if sig is not None and sig == collector["last_sig"]:
                    return
                if sig is not None:
                    collector["last_sig"] = sig
                vis = await web_vision(agent.browser_session, vision_llm, results_dir, shot_counter, vision_usage)
                collector["ran"] += 1
                # Geometry-corroborated gate: an uncorroborated clipping-class
                # vision HIGH is demoted (recorded for triage, does NOT fail the
                # run) — see gate_highs / _CLIP_CLASS_RE. `high` reflects what
                # actually gates; `demoted` preserves the describer's raw claim.
                gating, demoted = gate_highs(geo["highs"], vis["highs"])
                collector["checkpoints"].append({
                    "checkpoint": collector["ran"],
                    "geometry": geo["report"],
                    "vision": f"VISION: {vis['text']}",
                    "high": gating,
                    "demoted": demoted,
                })
                if gating:
                    collector["highs"].append({"checkpoint": collector["ran"], "defects": gating})
            except Exception as e:  # noqa: BLE001 — observer must never break the step
                print(f"[autovisual] step-end hook error (ignored): {e!r}")
        return on_step_end

    # browser-use Agent supports a single `llm` + `fallback_llm` natively
    # (step-level fallback inside its retry loop). To extend to N fallbacks we
    # run scenario-level retries: a failed attempt re-creates the Agent with
    # the next model. WHY: simpler than monkey-patching browser-use's internals
    # and uniform with the TS runner's approach. Extra cost on retry ≈ steps
    # already taken × per-step token cost (~$0.02 for a 5-step failed run).
    history = None
    final_text = ""
    last_attempt_idx = 0

    for idx, model in enumerate(chain, start=1):
        last_attempt_idx = idx
        print(f"[runner] attempt {idx} with model={model}")

        # Fresh visual timeline for this attempt (mirrors the Android runner
        # building a new AutoVisual per attempt).
        collector["last_sig"] = None
        collector["ran"] = 0
        collector["checkpoints"] = []
        collector["highs"] = []

        # Primary on this attempt, plus the NEXT model as browser-use's
        # step-level fallback if available — gives us belt + suspenders.
        primary = ChatGoogle(model=model, temperature=0)
        next_fallback = chain[idx] if idx < len(chain) else None
        fb = ChatGoogle(model=next_fallback, temperature=0) if next_fallback else None

        # WHY VISIBLE env: lets the dev watch the agent drive Chromium.
        # Currently DEFAULT=visible (Phase 5 verification period — user wants
        # to see every test). Flip back by exporting VISIBLE=0 or editing the
        # default below. Visible costs: ~200MB RAM + host display refresh.
        visible = os.environ.get("VISIBLE", "1") == "1"
        # Always pass a profile so we get explicit control over headless. If
        # we pass None when headless, browser-use uses its own default which
        # is also headless — but being explicit makes the diff to verdict.json
        # log lines obvious for debugging.
        browser_profile = BrowserProfile(headless=not visible)
        agent = Agent(
            task=build_task(scenario),
            llm=primary,
            fallback_llm=fb,
            browser_profile=browser_profile,
            tools=tools,
        )
        # Attach the auto-check hook only in visual mode.
        run_kwargs = {"max_steps": args.max_steps}
        if has_visual:
            run_kwargs["on_step_end"] = make_on_step_end()
        try:
            history = await agent.run(**run_kwargs)
        except Exception as e:
            print(f"[runner] attempt {idx} threw: {e!r}; trying next model")
            # A thrown attempt still consumed tokens before dying — bill them so
            # the cost figure reflects the real spend, then move on. Each Agent
            # has its OWN token_cost_service, so summing per attempt is correct.
            try:
                s = await agent.token_cost_service.get_usage_summary()
                agent_usage["input"] += s.total_prompt_tokens or 0
                agent_usage["output"] += s.total_completion_tokens or 0
                agent_usage["total"] += s.total_tokens or 0
            except Exception:  # noqa: BLE001 — usage accounting must never mask the real error
                pass
            continue

        # Roll this attempt's agent tokens into the running total (failed retries
        # cost real tokens too — same policy as the TS Android runner).
        try:
            s = await agent.token_cost_service.get_usage_summary()
            agent_usage["input"] += s.total_prompt_tokens or 0
            agent_usage["output"] += s.total_completion_tokens or 0
            agent_usage["total"] += s.total_tokens or 0
        except Exception as e:  # noqa: BLE001
            print(f"[runner] usage capture failed (attempt {idx}): {e!r}")

        # Inspect the result: PASS / FAIL / empty.
        final = history.final_result() if hasattr(history, "final_result") else None
        final_text = (final or "").strip()
        upper = final_text.upper()
        if upper.startswith("PASS") or upper.startswith("FAIL"):
            break  # Real verdict — done.
        # No PASS/FAIL prefix and no final result → model gave up; try next.
        print(f"[runner] attempt {idx} produced no verdict; trying next model")

    # `final_text` and `last_attempt_idx` are populated by the loop above.
    # WHY parse PASS/FAIL prefix (rather than asking the LLM for a JSON verdict):
    # browser-use's task contract already returns a free-form summary; layering
    # a JSON requirement on top fights the framework. The prefix is a 4-byte
    # discriminator the model reliably emits with a one-line system instruction.
    upper = final_text.upper()
    if upper.startswith("PASS"):
        verdict = "pass"
    elif upper.startswith("FAIL"):
        verdict = "fail"
    else:
        verdict = "error"

    # HARD VISUAL GATE (web). Any HIGH from the per-step auto-check overrides the
    # model's verdict — same "both hard-fail" policy as Android. The model never
    # gets a vote on a clipped/occluded/overflowing page. Checkpoints are always
    # persisted in visual mode (a clean file proves the pages WERE audited).
    if has_visual:
        if collector["highs"]:
            summary = " | ".join(
                f"[cp{h['checkpoint']}] {'; '.join(h['defects'])}" for h in collector["highs"]
            )
            n = len(collector["highs"])
            if verdict == "pass":
                verdict = "fail"
                final_text = f"FAIL: visual FAIL ({n} HIGH): {summary}"
            elif verdict == "fail":
                final_text = f"{final_text} | visual FAIL: {summary}"
            # error stays error; the HIGHs are still recorded below for triage.
        (results_dir / "visual-checkpoints.json").write_text(
            json.dumps(collector["checkpoints"], indent=2)
        )

    # Annotate the reason with which model in the chain produced the verdict —
    # makes it obvious from verdict.json alone whether a fallback was needed.
    chain_label = f"  [via model {last_attempt_idx}/{len(chain)}: {chain[last_attempt_idx-1] if chain else '?'}]"

    # Derive cost from the measured tokens, mirroring the TS Android runner so the
    # aggregator's TOKENS/COST columns populate for web too (they read .tokens.total
    # and .costUsd). Pricing lives in config.json — `null` block ⇒ costUsd null,
    # tokens still recorded. Agent and describer are DIFFERENT models, so each is
    # priced with its own rate. WHY output is billed as (total - input): Gemini's
    # output_tokens EXCLUDES thinking tokens, but those bill at the output rate —
    # (total - input) recovers them. clamp ≥0 guards a malformed usage row.
    def _cost(usage: dict, rates: dict | None) -> float | None:
        if not rates:
            return None
        out_billed = max(0, usage["total"] - usage["input"])
        return (usage["input"] / 1_000_000) * rates["inputPerMTok"] + \
               (out_billed / 1_000_000) * rates["outputPerMTok"]

    pricing = cfg.get("pricing")
    vision_pricing = cfg.get("visionPricing") or pricing  # fall back to agent rates
    agent_cost = _cost(agent_usage, pricing)
    vision_cost = _cost(vision_usage, vision_pricing)
    cost_usd = None if agent_cost is None and vision_cost is None else \
        (agent_cost or 0.0) + (vision_cost or 0.0)

    tokens = {
        "input": agent_usage["input"] + vision_usage["input"],
        "output": agent_usage["output"] + vision_usage["output"],
        "total": agent_usage["total"] + vision_usage["total"],
    }

    # Persist verdict + per-step trace for orchestrator aggregation.
    (results_dir / "verdict.json").write_text(json.dumps({
        "verdict": verdict,
        "reason": (final_text or "agent ended without a final summary") + chain_label,
        "steps": len(history.history) if history is not None and hasattr(history, "history") else None,
        "tokens": tokens,
        "costUsd": cost_usd,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
    }, indent=2))

    # Dump the structured history so the trace is grep-friendly like the TS one.
    # Guarded: if every attempt in the chain threw before returning a history
    # object, there's nothing to save — skip the dump cleanly.
    if history is not None:
        try:
            history.save_to_file(str(results_dir / "trace.json"))
        except Exception as e:  # pragma: no cover — purely diagnostic
            (results_dir / "trace.error.txt").write_text(f"trace export failed: {e!r}")

    print(f"[runner] {verdict.upper()}: {final_text[:200]}")
    return 0 if verdict == "pass" else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
