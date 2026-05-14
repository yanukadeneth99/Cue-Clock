/**
 * Dark broadcast palette — canonical design tokens.
 *
 * Three-tier surface stack: `page` (deepest) → `background` (default) → `surface` (cards).
 * Single accent (blue) for CTA/brand. Amber `countdown` is reserved for time-urgency +
 * alarm state ONLY. Red `danger` is reserved for <1m critical + destructive actions ONLY.
 *
 * Legacy keys (`header`, `pickerText`, `pickerBg`) are kept for back-compat with existing
 * call sites in `app/index.tsx`. New code should use `text` / `textMuted` instead.
 */
export const colors = {
  // Surface stack
  page: "#0a0b0e",            // page bg behind the phone frame (deepest)
  background: "#1a1d23",      // primary surface (default screen bg)
  surface: "#252830",          // cards, sheets, settings rows
  surfaceBorder: "#353840",   // card borders, dividers, toggle off-track
  border: "#3f434d",           // heavier divider

  // Text
  text: "#e8eaed",             // primary text + clock numerals
  textMuted: "#8b8f96",        // secondary labels, meta, hints

  // Accent + brand
  accent: "#60a5fa",           // primary CTA, brand dot, "Up Next" chip, active states

  // Zone dots (display clocks)
  zone1: "#4ade80",            // green
  zone2: "#f87171",            // red (calm)

  // Time-urgency tokens (use ONLY for countdown + alarm)
  countdown: "#fbbf24",        // amber — warn (<5m) + alarm surface tint
  danger: "#ef4444",           // red — critical (<1m) + destructive actions

  // ─── Legacy aliases (do not use in new code) ─────────────────────────
  header: "#e8eaed",           // alias of `text`
  pickerText: "#e8eaed",       // alias of `text`
  pickerBg: "#2f323a",         // legacy picker fill — slated for removal with ClockPicker
  muted: "#8b8f96",            // alias of `textMuted`
};
