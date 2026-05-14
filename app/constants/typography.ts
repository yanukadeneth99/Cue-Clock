import { Platform, TextStyle } from "react-native";

/**
 * Typography spec - Inter for all UI, Space Mono for numerics.
 *
 * On native, families resolve to fonts loaded via expo-font in the root layout.
 * Inter weights 400/500/600/700 must be registered there before these names work;
 * SpaceMono-Regular is already bundled (assets/fonts). On web, we fall back to
 * Inter via Google Fonts and Space Mono via the system monospace stack.
 *
 * Always pair clock / countdown text with `fontVariantNumeric: 'tabular-nums'`
 * (already wired in the `mono` presets below) to prevent digit jitter.
 */

export const fonts = {
  // sans (Inter) - use these as `fontFamily` values
  sans: Platform.select({
    web: "Inter, system-ui, -apple-system, sans-serif",
    default: "Inter",
  }),
  sansMedium: Platform.select({
    web: "Inter, system-ui, -apple-system, sans-serif",
    default: "Inter-Medium",
  }),
  sansSemibold: Platform.select({
    web: "Inter, system-ui, -apple-system, sans-serif",
    default: "Inter-SemiBold",
  }),
  sansBold: Platform.select({
    web: "Inter, system-ui, -apple-system, sans-serif",
    default: "Inter-Bold",
  }),
  // mono (Space Mono) - numeric/clock displays only
  mono: Platform.select({
    web: '"Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    default: "SpaceMono-Regular",
  }),
} as const;

/**
 * Named text-style presets - measured straight from the design reference.
 * Keys match the role, not the size, so renames in design propagate cleanly.
 */
export const text: Record<string, TextStyle> = {
  // Wordmark + screen titles
  brand: { fontFamily: fonts.sansSemibold, fontSize: 16, letterSpacing: -0.16 },
  sheetTitle: { fontFamily: fonts.sansSemibold, fontSize: 17, letterSpacing: -0.17 },

  // Section labels / chips (UP NEXT, QUEUED, RINGING…)
  chip: {
    fontFamily: fonts.sansSemibold,
    fontSize: 11,
    letterSpacing: 0.88, // ~0.08em at 11sp
    textTransform: "uppercase",
  },
  chipWide: {
    fontFamily: fonts.sansSemibold,
    fontSize: 11,
    letterSpacing: 1.65, // ~0.15em
    textTransform: "uppercase",
  },

  // Meta labels in PrimaryCard footer
  metaLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metaValue: { fontFamily: fonts.sansSemibold, fontSize: 13 },

  // Body / settings rows / hints
  body: { fontFamily: fonts.sansMedium, fontSize: 14 },
  bodySmall: { fontFamily: fonts.sansMedium, fontSize: 13 },
  hint: { fontFamily: fonts.sansMedium, fontSize: 12 },
  footnote: { fontFamily: fonts.sansMedium, fontSize: 11 },

  // Cue name (PrimaryCard) - base size; grows with urgency at runtime
  cueName: { fontFamily: fonts.sansSemibold, fontSize: 19, letterSpacing: -0.19, lineHeight: 25 },
  cueNameQueued: { fontFamily: fonts.sansMedium, fontSize: 14.5 },

  // Numeric / clock displays
  clockLarge: { fontFamily: fonts.mono, fontSize: 34, letterSpacing: -1.36, lineHeight: 34 },
  clockSeconds: { fontFamily: fonts.mono, fontSize: 20, letterSpacing: -0.8 },
  countdownPrimary: { fontFamily: fonts.mono, fontSize: 58, letterSpacing: -1.74, lineHeight: 58 },
  countdownCritical: { fontFamily: fonts.mono, fontSize: 96, letterSpacing: -2.88, lineHeight: 96 },
  countdownHero: { fontFamily: fonts.mono, fontSize: 72, letterSpacing: -4.32, lineHeight: 66 },
  queuedTime: { fontFamily: fonts.mono, fontSize: 22, letterSpacing: -0.66 },

  // Build/internal labels
  internalTag: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
};

/**
 * Linear interpolation between two text presets - used by PrimaryCard to grow
 * countdown font size as urgency rises 0 → 1.
 */
export function lerpFontSize(min: number, max: number, t: number): number {
  return Math.round(min + (max - min) * Math.max(0, Math.min(1, t)));
}
