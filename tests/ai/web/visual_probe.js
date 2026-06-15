// Deterministic visual-layout probe for the WEB build — the browser-side analog
// of the Android runner's visual.ts (Approach B of the visual-QA design).
//
// WHY a .js file injected into the page (not Python): geometry lives in the DOM.
// getBoundingClientRect / scrollWidth / getComputedStyle only exist inside the
// page, so the rules MUST run there. runner.py reads this file and ships it to
// the page via CDP Runtime.evaluate (returnByValue), then formats the JSON the
// IIFE returns. Keeping it as a standalone file (not a Python string) means it
// stays syntax-highlighted, lintable, and editable on its own — same separation
// visual.ts gives the Android side.
//
// WHY it mirrors visual.ts's RULESET but not its mechanism: on Android the rects
// come from the a11y tree; here they come from live DOM layout. The CHECKS are
// the same hard, deterministic gate — viewport overflow, ellipsis/clip
// truncation, zero-area text, unrelated-element overlap. Word-wrap and font-size
// are deliberately NOT checked here (height alone can't tell a large display
// font from wrapped text — Cue Clock's clock/countdown digits are tall BY
// DESIGN), exactly as in visual.ts; those subjective calls are the vision
// layer's job in runner.py's visual_check.
//
// Returns (via returnByValue) a JSON-able object:
//   { screen: {w, h}, findings: [{severity, kind, detail}, ...] }
// runner.py renders it into the same "GEOMETRY: X high, Y warn, Z info" report
// the Android tool emits, so both runners read identically downstream.
(function () {
  try {
    // A few px of slack: sub-pixel layout rounding means a perfectly-fitted
    // full-width element can report right = innerWidth + 0.5. Flagging that is
    // pure noise, so we only fire past a small margin (matches EDGE_TOL_PX).
    var EDGE_TOL_PX = 2;
    // Two unrelated text leaves whose intersection covers more than this
    // fraction of the SMALLER one are treated as colliding (matches
    // OVERLAP_AREA_FRAC). Normalising by the smaller node catches both
    // "tiny icon on big text" and "big text on tiny icon".
    var OVERLAP_AREA_FRAC = 0.6;

    var screenW = window.innerWidth;
    var screenH = window.innerHeight;
    var findings = [];

    function trunc(s, max) {
      max = max || 50;
      s = (s || "").replace(/\s+/g, " ").trim();
      return s.length > max ? s.slice(0, max - 1) + "…" : s;
    }

    function isVisible(el, cs) {
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      if (parseFloat(cs.opacity || "1") === 0) return false;
      return true;
    }

    // A text LEAF = an element with NO child ELEMENTS but non-empty text. WHY
    // leaves only (same reason visual.ts scopes to TextView): React-Native-Web
    // renders a card/row as a <div> whose textContent is the CONCATENATION of
    // every descendant's text and whose rect spans the whole card. Judging those
    // containers makes every card "overlap" its neighbours. The real text sits
    // in childless leaves with a tight rect. Bonus vs Android: two distinct
    // leaves can NEVER be ancestor/descendant (both are childless), so the
    // overlap pass needs no ancestry guard at all.
    var all = document.querySelectorAll("body *");
    var leaves = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.children.length !== 0) continue;
      var text = (el.textContent || "").trim();
      if (!text) continue;
      var cs = window.getComputedStyle(el);
      if (!isVisible(el, cs)) continue;
      var rect = el.getBoundingClientRect();
      leaves.push({ el: el, cs: cs, rect: rect, text: text });
    }

    function rectStr(r) {
      return (
        "[" +
        Math.round(r.left) +
        "," +
        Math.round(r.top) +
        " " +
        Math.round(r.width) +
        "x" +
        Math.round(r.height) +
        "]"
      );
    }

    // --- 1. Horizontal overflow: a text leaf extends past the viewport's
    // right/left edge. HIGH: this app has no horizontal scrolling, so anything
    // past the edge is genuinely clipped/unreachable.
    for (var a = 0; a < leaves.length; a++) {
      var L = leaves[a];
      if (L.rect.right > screenW + EDGE_TOL_PX) {
        findings.push({
          severity: "high",
          kind: "overflow-horizontal",
          detail:
            '"' +
            trunc(L.text) +
            '" extends to x=' +
            Math.round(L.rect.right) +
            " past viewport width " +
            screenW +
            " (rect " +
            rectStr(L.rect) +
            ")",
        });
      } else if (L.rect.left < -EDGE_TOL_PX) {
        findings.push({
          severity: "high",
          kind: "overflow-left",
          detail:
            '"' +
            trunc(L.text) +
            '" starts off-screen at x=' +
            Math.round(L.rect.left) +
            " (rect " +
            rectStr(L.rect) +
            ")",
        });
      }
    }

    // --- 2. Truncation: the text does not fit its own box and the box is set to
    // clip it. scrollWidth > clientWidth means the content is wider than the
    // visible area; pairing that with an overflow style that hides/ellipsizes
    // the excess is an explicit "this didn't fit" signal — HIGH. (A box that
    // simply wraps has scrollWidth == clientWidth, so this never fires on
    // intentional wrapping — wrap is the vision layer's call.)
    for (var b = 0; b < leaves.length; b++) {
      var M = leaves[b];
      var clipsX =
        M.cs.textOverflow === "ellipsis" ||
        M.cs.overflowX === "hidden" ||
        M.cs.overflowX === "clip" ||
        M.cs.overflow === "hidden" ||
        M.cs.overflow === "clip";
      if (clipsX && M.el.scrollWidth > M.el.clientWidth + EDGE_TOL_PX) {
        var how = M.cs.textOverflow === "ellipsis" ? "ellipsized" : "clipped";
        findings.push({
          severity: "high",
          kind: "truncation",
          detail:
            '"' +
            trunc(M.text) +
            '" is ' +
            how +
            " (content " +
            M.el.scrollWidth +
            "px wide in a " +
            M.el.clientWidth +
            "px box, rect " +
            rectStr(M.rect) +
            ")",
        });
      }
    }

    // --- 3. Collapsed text: a leaf HAS text but zero width or height — it
    // rendered but is invisible/clipped to nothing. WARN (often a flex/measure
    // bug). Note isVisible already dropped display:none, so a zero rect here is a
    // layout collapse, not a hidden element.
    for (var c = 0; c < leaves.length; c++) {
      var N = leaves[c];
      if (N.rect.width <= 0 || N.rect.height <= 0) {
        findings.push({
          severity: "warn",
          kind: "zero-size-text",
          detail:
            '"' +
            trunc(N.text) +
            '" has zero-area rect ' +
            rectStr(N.rect) +
            " (rendered but invisible?)",
        });
      }
    }

    // --- 4. Overlap/collision: two text leaves whose rects substantially
    // intersect. WARN (intentional text-over-image layering exists on the web,
    // so not HIGH — but a real collision is a clear defect worth surfacing).
    var positive = leaves.filter(function (x) {
      return x.rect.width > 0 && x.rect.height > 0;
    });
    function interArea(r1, r2) {
      var x = Math.max(r1.left, r2.left);
      var y = Math.max(r1.top, r2.top);
      var r = Math.min(r1.right, r2.right);
      var btm = Math.min(r1.bottom, r2.bottom);
      var w = r - x;
      var h = btm - y;
      return w > 0 && h > 0 ? w * h : 0;
    }
    for (var p = 0; p < positive.length; p++) {
      for (var q = p + 1; q < positive.length; q++) {
        var A = positive[p];
        var B = positive[q];
        var inter = interArea(A.rect, B.rect);
        if (inter <= 0) continue;
        var minArea = Math.min(
          A.rect.width * A.rect.height,
          B.rect.width * B.rect.height
        );
        if (minArea > 0 && inter / minArea >= OVERLAP_AREA_FRAC) {
          findings.push({
            severity: "warn",
            kind: "overlap",
            detail:
              '"' +
              trunc(A.text) +
              '" overlaps "' +
              trunc(B.text) +
              '" (' +
              Math.round((inter / minArea) * 100) +
              "% of the smaller element)",
          });
        }
      }
    }

    var order = { high: 0, warn: 1, info: 2 };
    findings.sort(function (f1, f2) {
      return order[f1.severity] - order[f2.severity];
    });

    // Structure-only signature for the per-step auto-check's dedup (runner.py's
    // on_step_end hook). WHY tag+rect but NOT text: Cue Clock's web clock ticks
    // every second, so any signature hashing visible text would differ on every
    // step and dedup would never skip the paid vision call. The SET of text-leaf
    // tags+rects is stable across a tick (the digit changes, its box doesn't) but
    // changes the instant real structure moves (a modal opens, a row is added).
    // Mirrors structureSignature() in the Android visual.ts exactly.
    var sigParts = leaves.map(function (L) {
      return (
        L.el.tagName +
        "@" +
        Math.round(L.rect.left) +
        "," +
        Math.round(L.rect.top) +
        "," +
        Math.round(L.rect.width) +
        "x" +
        Math.round(L.rect.height)
      );
    });
    sigParts.sort();

    return {
      screen: { w: screenW, h: screenH },
      findings: findings,
      signature: sigParts.join("|"),
    };
  } catch (e) {
    // Surface the error as a structured result so runner.py can report
    // "GEOMETRY: unavailable (...)" instead of crashing the whole step.
    return { error: String((e && e.message) || e), findings: [] };
  }
})();
