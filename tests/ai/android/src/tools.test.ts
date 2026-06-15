// Unit tests for tools.ts pure helpers. Run with:
//   node --import tsx --test src/tools.test.ts
// No device/network needed — countAppRefs is pure and importing tools.ts has no
// side effects (run() only fires when called, the vision LLM is lazy).
//
// WHY these fixtures are verbatim trace captures (not hand-written): they are the
// REAL snapshots from the 12-hour relaunch-spiral run (results/run-2026-06-15T04-28-02Z).
// The splash snapshot looks "mounted" to the old refCount because the Mi A2 Lite's
// software nav bar (Back/Home) always contributes @e refs even before the RN UI
// exists — that false-ready is what let open_app return on the splash and kicked
// off the relaunch spiral. The test pins the discriminator: nav-bar-only ⇒ 0.

import { test } from "node:test";
import assert from "node:assert/strict";
import { countAppRefs } from "./tools.ts";

// Trace step 2: app still on the Expo splash. The ONLY @e refs are the Android
// software navigation bar (Back/Home) — there is zero app content here.
const SPLASH_NAV_BAR_ONLY = [
  "Page: com.yanukadeneth99.cueclock",
  "App: com.yanukadeneth99.cueclock",
  "Snapshot: 3 nodes",
  '@e1 [image] "Back"',
  "@e2 [group]",
  '@e3 [image] "Home"',
].join("\n");

// Trace step 9: onboarding modal has mounted. Nav bar is STILL present (@e1/@e3),
// now joined by real app content (@e5 scroll-area, @e6 "Open app settings").
const MOUNTED_ONBOARDING = [
  "Page: com.yanukadeneth99.cueclock",
  "App: com.yanukadeneth99.cueclock",
  "Snapshot: 6 visible nodes (15 total)",
  "Collapsed 9 Android helper nodes from the agent-facing text snapshot; use --raw or --json for the full hierarchy.",
  '@e1 [image] "Back"',
  "@e2 [group]",
  '@e3 [image] "Home"',
  "@e5 [scroll-area] [scrollable]",
  '@e6 [group] "Open app settings"',
].join("\n");

test("countAppRefs ignores the nav bar on the splash screen (0 app refs)", () => {
  // The splash exposes only Back/Home soft keys — NOT app content. The readiness
  // gate must read this as "not mounted yet" so open_app keeps waiting.
  assert.equal(countAppRefs(SPLASH_NAV_BAR_ONLY), 0);
});

test("countAppRefs counts real content once the app UI has mounted", () => {
  // @e5 (scroll-area) and @e6 ("Open app settings") are genuine app refs; Back/Home
  // must NOT inflate the count, but the gate should fire (>= 1) here.
  assert.ok(countAppRefs(MOUNTED_ONBOARDING) >= 1);
});

test("countAppRefs returns 0 for an empty / failed snapshot", () => {
  // run() returns "" when a mid-mount snapshot transiently fails; that must read
  // as not-ready, not crash.
  assert.equal(countAppRefs(""), 0);
});
