"use client";

import { useEffect, useState } from "react";

// The automation pipeline drawn as a mermaid flowchart. The node and edge STRUCTURE must stay in sync with the diagram in the repository README ("How the Automation Works"); the styling below is website-only, because GitHub themes README diagrams itself while here we match the site tokens.
// Node shapes carry meaning: rounded rectangles are actions, diamonds are AI decisions. The class lines at the bottom colour-code the story:
//   source  - where work enters (grey, quiet)
//   ai      - automated work (card surface)
//   decision- AI judgement gates (accent border)
//   ship    - something reaching real people (green, zone1)
//   wait    - paused for the maintainer (amber, countdown)
//   tg      - Telegram messages to the maintainer (accent)
const DIAGRAM = `flowchart TD
    A("You or a user reports a bug or idea as an issue") --> B{"AI triage: is it clear and safe to build?"}
    X("Crashlytics detects a crash in the live app") --> X2("Each morning, new crashes are filed as issues automatically")
    X2 --> B
    W("Weekly AI scans hunt for bugs, removable code, and speed-ups, filing issues") --> B
    B -- "No, or unclear" --> C("Waits for the maintainer with a question")
    B -- "Yes" --> D("AI writes the code and opens a pull request")
    E("Dependabot suggests a library update") --> F
    D --> F("The app is built and tested automatically")
    F -- "Build fails" --> G("AI tries to repair it, up to 5 times")
    G --> F
    F -- "Build passes" --> H{"A second AI reviews the change as a strict critic"}
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
    class D,F,G,I,K,M ai
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

  useEffect(() => {
    let cancelled = false;
    // Mermaid is heavy and this diagram sits far below the fold, so it is loaded on demand in the browser only and must never slow the first paint.
    import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
        // Roomier layout and gently curved edges instead of the default tight elbows: this diagram is decoration as much as documentation.
        flowchart: { curve: "basis", nodeSpacing: 46, rankSpacing: 60, padding: 8 },
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
        const rendered = await mermaid.render("pipeline-diagram-svg", DIAGRAM);
        if (!cancelled) setSvg(rendered.svg);
      } catch {
        // A render failure only means the placeholder stays; the page must never break over decoration.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!svg) {
    // Same pulse placeholder the stats cards use while data loads.
    return <div className="rounded-[14px] bg-card animate-pulse h-96" aria-hidden="true" />;
  }

  return (
    <div>
      {/* Safe use of dangerouslySetInnerHTML: the SVG is produced by mermaid from the hardcoded DIAGRAM constant above, with mermaid's default "strict" security level sanitizing labels. No user or network input reaches it. */}
      <div
        role="img"
        aria-label="Diagram of the automated pipeline: issues, crashes, and weekly AI scans are triaged by AI, implemented, built, repaired if needed, adversarially reviewed, merged, and released to beta and production with a human pressing Publish, while Telegram keeps the maintainer informed"
        className="overflow-x-auto [&_svg]:mx-auto [&_svg]:min-w-[640px] [&_svg]:max-w-none md:[&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2" aria-hidden="true">
        {LEGEND.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-2 text-[12px] text-fg-muted">
            <span
              className="w-2.5 h-2.5 rounded-full border"
              style={{ borderColor: item.colour, backgroundColor: `${item.colour}33` }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
