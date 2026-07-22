"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Icon from "@/components/Icon";

// "Zoom" here is a multiplier of the FIT-TO-WIDTH baseline: 1 shows the whole
// diagram across the container width, higher values zoom in for detail. Because
// the floor is 1 (fit), the diagram can never render smaller than "fully
// visible" - the old tiny/pinhead states are impossible by construction, since
// the SVG's size comes from layout (width: 100%) not from a measured value.
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
// How much one button press changes the zoom, and how sensitive wheel zoom is.
const ZOOM_STEP = 0.3;
const WHEEL_SENSITIVITY = 0.0015;

const clampZoom = (next: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));

// Every mermaid.render() call needs its OWN element id. React Strict Mode
// mounts this component twice in dev, so the render effect fires twice and,
// with a shared id, both runs fight over the same temporary DOM node mermaid
// uses to measure text - and also share the SVG's internal marker ids. A
// per-call counter guarantees each render gets a unique, non-colliding id.
let renderId = 0;

// The automation pipeline drawn as a mermaid flowchart. The node and edge STRUCTURE must stay in sync with the diagram in the repository README ("How the Automation Works"); the styling below is website-only, because GitHub themes README diagrams itself while here we match the site tokens.
// Node shapes carry meaning: rounded rectangles are actions, diamonds are AI decisions. The class lines at the bottom colour-code the story:
//   source  - where work enters (grey, quiet)
//   ai      - automated work (card surface)
//   decision- AI judgement gates (accent border)
//   ship    - something reaching real people (green, zone1)
//   wait    - paused for the maintainer (amber, countdown)
//   tg      - Telegram messages to the maintainer (accent)
const DIAGRAM = `flowchart LR
    A("You or a user reports a bug or idea as an issue") --> B{"AI triage: is it clear and safe to build?"}
    X("Crashlytics detects a crash in the live app") --> X2("Each morning, new crashes are filed as issues automatically")
    X2 --> B
    W("Weekly AI scans hunt for bugs, removable code, speed-ups, and code-quality problems, filing issues") --> B
    B -- "No, or unclear" --> C("Waits for the maintainer with a question")
    B -- "Yes" --> R("AI researches the issue and posts notes for the builder")
    R --> D("AI writes the code and opens a pull request")
    E("Dependabot suggests a library update") --> F
    D --> F("The app is built and tested automatically")
    F -- "Build fails" --> G("AI tries to repair it, up to 5 times")
    G --> F
    F -- "Build passes" --> Q("A code-quality gate checks the pull request")
    Q -- "Quality issue found" --> G
    Q -- "Looks clean" --> H{"A second AI reviews the change as a strict critic"}
    H -- "Rejected" --> G
    G -- "Out of attempts" --> C
    H -- "Approved" --> I("Merged automatically")
    I --> J("A private test build goes to Google Play")
    I --> K("AI drafts the beta release notes")
    K --> L("Maintainer presses Publish: beta goes to public testers")
    L --> M("AI drafts the production release notes")
    M --> N("Maintainer presses Publish: the exact tested build reaches real users, and the web app updates")
    C -- "daily summary of what needs a human" --> TG("Telegram message to the maintainer")
    K -- "draft ready to review" --> TG
    M -- "draft ready to review" --> TG
    classDef source fill:#15171d,stroke:#353840,color:#8b8f96,stroke-width:1px
    classDef ai fill:#252830,stroke:#3f434d,color:#e8eaed,stroke-width:1px
    classDef decision fill:#1c2636,stroke:#60a5fa,color:#e8eaed,stroke-width:1.5px
    classDef ship fill:#17251d,stroke:#4ade80,color:#e8eaed,stroke-width:1.5px
    classDef wait fill:#272113,stroke:#fbbf24,color:#e8eaed,stroke-width:1.5px
    classDef tg fill:#1c2636,stroke:#60a5fa,color:#e8eaed,stroke-width:1px
    class A,X,X2,W,E source
    class D,F,G,I,K,M,R,Q ai
    class B,H decision
    class J,L,N ship
    class C wait
    class TG tg
    linkStyle default stroke:#5c6069,stroke-width:1.5px`;

// The legend mirrors the classDef colours above.
const LEGEND = [
  { colour: "#3f434d", label: "Automated work" },
  { colour: "#60a5fa", label: "AI decision gate" },
  { colour: "#fbbf24", label: "Waiting on a human" },
  { colour: "#4ade80", label: "Reaches real people" },
];

export default function PipelineDiagram() {
  const [svg, setSvg] = useState<string | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
  // Mirror of `zoom` so the native wheel listener (subscribed once) can read the
  // current value without re-subscribing on every zoom change.
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Keep pan within the range where the scaled diagram still overlaps the
  // viewport, so it can never be dragged completely out of sight. offsetHeight
  // is the stage's NATURAL height (it ignores the CSS transform), so the maths
  // works off the un-zoomed size and multiplies by the target zoom.
  const clampPan = (next: { x: number; y: number }, atZoom: number) => {
    const vp = viewportRef.current;
    const stage = contentRef.current;
    if (!vp || !stage) return next;
    const cw = vp.clientWidth;
    const ch = vp.clientHeight;
    const sh = stage.offsetHeight;
    const maxX = Math.max(0, (atZoom * cw - cw) / 2);
    const maxY = Math.max(0, (atZoom * sh - ch) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };

  // Change zoom and immediately pull pan back inside the new bounds, so zooming
  // out re-centres content that a previous zoom-in had let you push to the edge.
  const applyZoom = (nextZoom: number) => {
    const z = clampZoom(nextZoom);
    setZoom(z);
    setPan((p) => clampPan(p, z));
  };

  const resetView = () => {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    let cancelled = false;
    // Mermaid is heavy and this diagram sits far below the fold, so it is loaded on demand in the browser only and must never slow the first paint.
    import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
        // Roomier layout and gently curved edges instead of the default tight elbows: this diagram is decoration as much as documentation.
        flowchart: {
          curve: "basis",
          nodeSpacing: 46,
          rankSpacing: 60,
          padding: 8,
        },
        // Colours mirror the canonical design tokens in globals.css; the per-class fills in the diagram source override these per node.
        themeVariables: {
          background: "#0a0b0e",
          primaryColor: "#252830",
          primaryTextColor: "#e8eaed",
          primaryBorderColor: "#353840",
          secondaryColor: "#1B1D24",
          tertiaryColor: "#1B1D24",
          lineColor: "#8b8f96",
          edgeLabelBackground: "#15171d",
          fontSize: "14px",
        },
      });
      try {
        // Wait for the real font before rendering. Mermaid sizes every node by
        // MEASURING its text, so if Inter has not loaded yet the node boxes come
        // out sized for the fallback font. This no longer affects the OVERALL
        // size (that is now fit-to-width), only whether text sits neatly inside
        // its boxes - but it is cheap and keeps the layout tidy on cold loads.
        if (typeof document !== "undefined" && document.fonts) {
          try {
            const family = getComputedStyle(document.body).fontFamily;
            await document.fonts.load(`16px ${family}`);
            await document.fonts.ready;
          } catch {
            // A fonts API hiccup must never block the diagram; fall through.
          }
        }
        const rendered = await mermaid.render(
          `pipeline-diagram-svg-${renderId++}`,
          DIAGRAM,
        );
        if (!cancelled) setSvg(rendered.svg);
      } catch {
        // A render failure only means the placeholder stays; the page must never break over decoration.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    // Force the injected SVG to fill the stage width and derive its height from
    // the diagram's own aspect ratio. These must be INLINE styles: mermaid ships
    // the SVG with an inline `max-width: <px>` that a Tailwind class could not
    // override, and that cap is exactly what used to stop it filling the width.
    // Setting them here is what makes the default view "fit to width".
    if (!svg || !contentRef.current) return;
    const svgEl = contentRef.current.querySelector("svg");
    if (!svgEl) return;
    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
    svgEl.style.maxWidth = "none";
    svgEl.style.display = "block";
    const viewBox = svgEl.getAttribute("viewBox");
    if (viewBox) {
      const [, , w, h] = viewBox.split(/\s+/).map(Number);
      // aspect-ratio makes the height deterministic from the first frame, so
      // there is no momentary jump before the browser works out the SVG size.
      if (w && h) svgEl.style.aspectRatio = `${w} / ${h}`;
    }
  }, [svg]);

  useEffect(() => {
    // Wired up as a native listener (not React's onWheel) because React
    // registers wheel handlers as passive by default - calling preventDefault()
    // from a passive listener is a silent no-op, so the page would scroll
    // underneath the diagram even while it zoomed. { passive: false } is
    // required for preventDefault() to actually stop the page scroll.
    const el = viewportRef.current;
    if (!svg || !el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyZoom(zoomRef.current - e.deltaY * WHEEL_SENSITIVITY);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Nothing to pan when the whole diagram already fits, so let the page
    // handle the gesture (e.g. scrolling) instead of trapping it.
    if (zoom <= MIN_ZOOM) return;
    setDragging(true);
    dragStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const next = {
      x: dragStart.current.panX + (e.clientX - dragStart.current.pointerX),
      y: dragStart.current.panY + (e.clientY - dragStart.current.pointerY),
    };
    setPan(clampPan(next, zoom));
  };
  const stopDragging = () => setDragging(false);

  if (!svg) {
    // Same pulse placeholder the stats cards use while data loads.
    return (
      <div
        className="rounded-[14px] bg-card animate-pulse h-96"
        aria-hidden="true"
      />
    );
  }

  const canPan = zoom > MIN_ZOOM;

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          type="button"
          onClick={() => applyZoom(zoom - ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
          className="w-8 h-8 grid place-items-center rounded-[10px] bg-card border border-card-border text-fg-muted hover:text-fg hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-fg-muted disabled:hover:border-card-border"
        >
          <Icon name="remove" className="text-[18px]" />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset zoom"
          className="w-8 h-8 grid place-items-center rounded-[10px] bg-card border border-card-border text-fg-muted hover:text-fg hover:border-accent transition-colors"
        >
          <Icon name="refresh" className="text-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => applyZoom(zoom + ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
          className="w-8 h-8 grid place-items-center rounded-[10px] bg-card border border-card-border text-fg-muted hover:text-fg hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-fg-muted disabled:hover:border-card-border"
        >
          <Icon name="add" className="text-[18px]" />
        </button>
      </div>
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
        className={`relative h-[300px] md:h-[380px] overflow-hidden rounded-[10px] bg-page/40 flex items-center justify-center ${
          canPan ? (dragging ? "cursor-grabbing touch-none" : "cursor-grab touch-none") : "cursor-default"
        }`}
      >
        {/* Safe use of dangerouslySetInnerHTML: the SVG is produced by mermaid from the hardcoded DIAGRAM constant above, with mermaid's default "strict" security level sanitizing labels. No user or network input reaches it. */}
        <div
          ref={contentRef}
          role="img"
          aria-label="Diagram of the automated pipeline: issues, crashes, and weekly AI scans are triaged by AI, researched, implemented, built, quality-checked, repaired if needed, adversarially reviewed, merged, and released to beta and production with a human pressing Publish, while Telegram keeps the maintainer informed"
          className="w-full [&>svg]:block"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: dragging ? "none" : "transform 140ms ease-out",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <p
        className="mt-2 text-center text-[11px] text-fg-muted"
        aria-hidden="true"
      >
        Scroll or use the buttons to zoom in, then drag to pan
      </p>
      <div
        className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2"
        aria-hidden="true"
      >
        {LEGEND.map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-2 text-[12px] text-fg-muted"
          >
            <span
              className="w-2.5 h-2.5 rounded-full border"
              style={{
                borderColor: item.colour,
                backgroundColor: `${item.colour}33`,
              }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
