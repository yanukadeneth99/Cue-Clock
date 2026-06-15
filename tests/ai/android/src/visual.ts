// Deterministic visual-layout checks (Approach B of the visual-QA design).
//
// WHY this exists: the functional agent loop is layout-BLIND. `snapshot -i -c`
// strips geometry, and the vision describer is only asked to enumerate tappable
// elements for navigation — neither notices a label that overflows its
// container, a text clipped at the screen edge, or two elements colliding. This
// module turns the geometry that `agent-device snapshot --raw` ALREADY exposes
// (rect per node) into hard, deterministic, token-free assertions.
//
// WHY pure functions (no CLI / no IO here): the geometry rules are the part
// worth testing without a device attached. tools.ts owns the `agent-device`
// invocation and the vision call; this file just parses + judges. Feed it the
// raw stdout string and it returns findings.
//
// WHY `--raw` (not adb `uiautomator dump`): uiautomator blocks on waitForIdle
// and HANGS on Cue Clock's always-ticking home screen (the same reason the
// screenshot tool passes --no-stabilize). `snapshot --raw` reads the
// accessibility tree directly, works mid-animation, AND tags every node with
// its owning bundleId so we can ignore the system UI sharing the screen.

export type RawNode = {
  index: number;
  type: string; // android widget class, e.g. android.widget.TextView
  label: string; // accessibility label / contentDescription / text
  value: string; // value (often mirrors text for TextViews)
  identifier: string;
  bundleId: string;
  rect: { x: number; y: number; width: number; height: number };
  depth: number;
  parentIndex?: number;
  ref: string;
};

export type VisualSeverity = "high" | "warn" | "info";

export type VisualFinding = {
  severity: VisualSeverity;
  kind: string; // short machine-ish category, e.g. "overflow-horizontal"
  detail: string; // human-readable, includes the offending text + rect
};

// Tolerances. WHY a few px of slack: sub-pixel rounding in the a11y rects means
// a perfectly-fitted full-width element can report right = screenW + 1. Flagging
// that as overflow would be pure noise, so we only fire past a small margin.
const EDGE_TOL_PX = 2;
// Two text-bearing leaves whose intersection covers more than this fraction of
// the SMALLER node are treated as overlapping/colliding. WHY fraction-of-smaller
// (not absolute area): a tiny icon nudged onto big text and big text nudged onto
// a tiny icon are the same bug; normalising by the smaller node catches both.
const OVERLAP_AREA_FRAC = 0.6;

// Parse the JSON-lines body of `agent-device snapshot --raw`. The command emits
// a few human-readable header lines ("Page: ...", "Snapshot: N nodes", optional
// "Hint: ...") followed by one JSON object per node. We keep only the lines that
// parse as a node object — robust to header text changing between CLI versions.
export function parseRawSnapshot(raw: string): {
  appPkg: string | null;
  nodes: RawNode[];
} {
  // "Page: <pkg>" names the foreground app — our filter target. Fall back to the
  // most common bundleId among parsed nodes if the header is ever absent.
  const pageMatch = raw.match(/^Page:\s*(\S+)/m);
  let appPkg = pageMatch ? pageMatch[1].trim() : null;

  const nodes: RawNode[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const obj = JSON.parse(t);
      // A node must have a rect to be useful for geometry. Anything else is junk.
      if (obj && obj.rect && typeof obj.rect.width === "number") {
        nodes.push(obj as RawNode);
      }
    } catch {
      // Not a node line (or truncated) — skip silently; headers land here too.
    }
  }

  if (!appPkg && nodes.length) {
    const counts = new Map<string, number>();
    for (const n of nodes)
      counts.set(n.bundleId, (counts.get(n.bundleId) ?? 0) + 1);
    appPkg = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  return { appPkg, nodes };
}

// A node's visible text — label preferred (it's the a11y label), value as backup.
function textOf(n: RawNode): string {
  return (n.label || n.value || "").trim();
}

// Only LEAF text widgets are valid geometry subjects. WHY this is essential:
// React Native renders a card/row as an `android.view.ViewGroup` whose a11y
// label is the CONCATENATION of all its descendants' text (e.g. a clock card
// labelled "BERLIN (GMT+2), 15:48, :19") and whose rect spans the WHOLE card.
// Judging those containers produced pure noise — every card "overlapped" its
// neighbours and every card looked "wrapped" because it's tall by definition.
// The actual text lives in `android.widget.TextView` leaves (single line, real
// rect), so every text rule scopes to those.
function isTextWidget(n: RawNode): boolean {
  return n.type.endsWith("TextView");
}

// Substrings of the React Native debug LogBox overlay. WHY exclude: debug builds
// (what the harness installs) show a persistent "Open debugger to view warnings"
// toast pinned at the bottom — it genuinely overlaps the app's bottom button,
// but it is a DEV-ONLY artifact absent from release builds, so flagging it on
// every run is a false alarm. A visual checkpoint should dismiss the overlay
// first; until then we filter its text out of the geometry pass.
const DEV_OVERLAY_TEXT = ["Open debugger to view warnings", "report a"];
function isDevOverlay(n: RawNode): boolean {
  const t = textOf(n);
  return DEV_OVERLAY_TEXT.some((s) => t.includes(s));
}

// Walk parentIndex up to the root to test ancestry. WHY: overlapping rects
// between a parent and its own child are EXPECTED (the child sits inside the
// parent) and must NOT be flagged as a collision. Only unrelated subtrees
// overlapping is a real defect.
function isRelated(a: RawNode, b: RawNode, byIndex: Map<number, RawNode>): boolean {
  const climbs = (from: RawNode, targetIndex: number): boolean => {
    let cur: RawNode | undefined = from;
    let guard = 0;
    while (cur && guard++ < 200) {
      if (cur.index === targetIndex) return true;
      cur = cur.parentIndex != null ? byIndex.get(cur.parentIndex) : undefined;
    }
    return false;
  };
  return climbs(a, b.index) || climbs(b, a.index);
}

// The core ruleset. Pass the parsed nodes + the app package to scope to; returns
// findings sorted high → warn → info. Empty array = clean layout.
export function analyzeGeometry(
  nodes: RawNode[],
  appPkg: string | null,
): VisualFinding[] {
  const findings: VisualFinding[] = [];
  if (!nodes.length) return findings;

  // Screen bounds derived from the data, not hardcoded — works on any device.
  // WHY from ROOT (parentless) nodes, NOT max over all nodes: an element that
  // overflows the screen IS the max right-edge, so deriving the width from
  // max(x+width) would silently stretch the "screen" to fit the overflow and the
  // overflow check could never fire. Top-level window containers (the app root,
  // status bar, nav bar) are always clamped to the real screen, so their extent
  // is the true device size; a leaf can spill past them. Fallback to all-nodes
  // max only if hierarchy is somehow absent.
  const roots = nodes.filter((n) => n.parentIndex == null);
  const dimSource = roots.length ? roots : nodes;
  const screenW = Math.max(...dimSource.map((n) => n.rect.x + n.rect.width));
  const screenH = Math.max(...dimSource.map((n) => n.rect.y + n.rect.height));

  // Scope to the app's OWN nodes. The status bar / nav bar belong to
  // com.android.systemui and legitimately span the full width — judging them
  // would be all false positives.
  const appNodes = appPkg
    ? nodes.filter((n) => n.bundleId === appPkg)
    : nodes;
  const byIndex = new Map<number, RawNode>(nodes.map((n) => [n.index, n]));

  // Text-bearing LEAF widgets drive every check — see isTextWidget for why
  // containers are excluded, and isDevOverlay for the debug-toast exclusion.
  const textNodes = appNodes.filter(
    (n) => isTextWidget(n) && textOf(n).length > 0 && !isDevOverlay(n),
  );

  // --- 1. Horizontal overflow: text extends past the screen's right/left edge.
  // HIGH: this app has no horizontal scrolling, so anything wider than the
  // screen is genuinely clipped/unreachable.
  for (const n of textNodes) {
    const right = n.rect.x + n.rect.width;
    if (right > screenW + EDGE_TOL_PX) {
      findings.push({
        severity: "high",
        kind: "overflow-horizontal",
        detail: `"${trunc(textOf(n))}" extends to x=${right} past screen width ${screenW} (rect ${rectStr(n)})`,
      });
    } else if (n.rect.x < -EDGE_TOL_PX) {
      findings.push({
        severity: "high",
        kind: "overflow-left",
        detail: `"${trunc(textOf(n))}" starts off-screen at x=${n.rect.x} (rect ${rectStr(n)})`,
      });
    }
  }

  // --- 2. (Intentionally NO textual-ellipsis rule on Android.)
  // WHY removed: uiautomator/agent-device reports a node's FULL set string
  // (getText()), not the visually-ellipsized layout. Real TextView truncation
  // happens at render time and does NOT append "…" to that string, so a trailing
  // ellipsis here can only mean the COPY literally ends in "…" (e.g. the
  // "We'll miss your support..." consent modal) — i.e. a guaranteed false
  // positive, never a genuine clip. Real on-screen truncation is the vision
  // pass's job (it reads pixels). Do NOT reintroduce a `txt.endsWith("…")`
  // check here. (The WEB probe is different and legitimate: it pairs an
  // ellipsis/clip style with a measured scrollWidth > clientWidth overflow.)

  // --- 3. Collapsed text: a node HAS text but zero width or height — it rendered
  // but is invisible/clipped to nothing. WARN (often a flex/measure bug).
  for (const n of textNodes) {
    if (n.rect.width <= 0 || n.rect.height <= 0) {
      findings.push({
        severity: "warn",
        kind: "zero-size-text",
        detail: `"${trunc(textOf(n))}" has zero-area rect ${rectStr(n)} (rendered but invisible?)`,
      });
    }
  }

  // --- 4. Overlap/collision: two unrelated text leaves whose rects substantially
  // intersect. WARN (text-over-background false positives are possible, so not
  // HIGH — but a real overlap is a clear visual defect worth surfacing).
  const positiveText = textNodes.filter(
    (n) => n.rect.width > 0 && n.rect.height > 0,
  );
  for (let i = 0; i < positiveText.length; i++) {
    for (let j = i + 1; j < positiveText.length; j++) {
      const a = positiveText[i];
      const b = positiveText[j];
      if (isRelated(a, b, byIndex)) continue;
      const inter = intersectionArea(a.rect, b.rect);
      if (inter <= 0) continue;
      const minArea = Math.min(
        a.rect.width * a.rect.height,
        b.rect.width * b.rect.height,
      );
      if (minArea > 0 && inter / minArea >= OVERLAP_AREA_FRAC) {
        findings.push({
          severity: "warn",
          kind: "overlap",
          detail: `"${trunc(textOf(a))}" overlaps "${trunc(textOf(b))}" (${Math.round((inter / minArea) * 100)}% of the smaller element)`,
        });
      }
    }
  }

  // NOTE: word-wrap and font-size-too-big/small are deliberately NOT checked
  // here. Height alone cannot distinguish a large single-line display font (Cue
  // Clock's countdown/clock digits are tall BY DESIGN) from text wrapped onto a
  // second line, so a height heuristic fires on every screen with a clock —
  // pure noise. Those judgments need to see the pixels and are owned by the
  // VISION layer in tools.ts `visual_check` (the describer is explicitly asked
  // about unexpected wrapping and oversized text).

  const order: Record<VisualSeverity, number> = { high: 0, warn: 1, info: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}

// A structure-only fingerprint of the app's text layout, used by the
// per-transition auto-check (autoVisual.ts) to skip the PAID vision call when a
// screen hasn't actually changed. WHY text content is DELIBERATELY excluded:
// Cue Clock's home screen ticks every second, so any signature that hashed the
// visible text would differ on every checkpoint and dedup would NEVER fire —
// exactly the trap a screenshot hash falls into. The SET of text-leaf
// types+rects, by contrast, is stable across a clock tick (the digit changes,
// its TextView's rect does not) but DOES change the moment real structure moves:
// a modal opens, a card is added, or the window resizes when the soft keyboard
// appears (which is precisely the keyboard-up checkpoint we want to re-audit).
// This is the same tree-stability signal waitForAppReady() relies on. Scoped to
// the app's own text leaves (system UI is irrelevant and would add noise).
export function structureSignature(
  nodes: RawNode[],
  appPkg: string | null,
): string {
  const appNodes = appPkg ? nodes.filter((n) => n.bundleId === appPkg) : nodes;
  const parts = appNodes
    .filter((n) => isTextWidget(n) && textOf(n).length > 0)
    .map(
      (n) =>
        `${n.type}@${Math.round(n.rect.x)},${Math.round(n.rect.y)},${Math.round(
          n.rect.width,
        )}x${Math.round(n.rect.height)}`,
    )
    .sort();
  return parts.join("|");
}

function intersectionArea(
  a: RawNode["rect"],
  b: RawNode["rect"],
): number {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.width, b.x + b.width);
  const btm = Math.min(a.y + a.height, b.y + b.height);
  const w = r - x;
  const h = btm - y;
  return w > 0 && h > 0 ? w * h : 0;
}

function rectStr(n: RawNode): string {
  return `[${n.rect.x},${n.rect.y} ${n.rect.width}x${n.rect.height}]`;
}

// Keep findings readable when a label is a whole paragraph.
function trunc(s: string, max = 50): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// Render findings into the compact text block the tool returns to the agent.
export function formatFindings(geo: VisualFinding[]): string {
  if (!geo.length) return "GEOMETRY: clean — no layout defects detected.";
  const counts = geo.reduce(
    (acc, f) => ((acc[f.severity] = (acc[f.severity] ?? 0) + 1), acc),
    {} as Record<string, number>,
  );
  const head = `GEOMETRY: ${counts.high ?? 0} high, ${counts.warn ?? 0} warn, ${counts.info ?? 0} info`;
  const lines = geo.map((f) => `  [${f.severity.toUpperCase()}] ${f.kind}: ${f.detail}`);
  return [head, ...lines].join("\n");
}
