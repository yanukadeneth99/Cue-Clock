/**
 * Continuous urgency factor — drives PrimaryCard scaling.
 *
 * Returns 0 when the countdown is calm (>5 min), 1 in the last minute, and
 * linearly interpolates across the 300s → 60s window in between. Consumers use
 * this single scalar to interpolate font size, padding, border opacity, and
 * halo radius simultaneously so the calm-to-critical transition reads as a
 * single coordinated motion rather than three stepped colour swaps.
 *
 * Note: this does NOT account for the buffer — pass already-buffer-deducted
 * seconds, matching `computeCountdown(...).total`.
 */
export function urgencyFactor(totalSeconds: number): number {
  if (!Number.isFinite(totalSeconds) || totalSeconds > 300) return 0;
  if (totalSeconds <= 60) return 1;
  return (300 - totalSeconds) / 240;
}

/** Linear interpolation. Clamps `t` to [0, 1]. */
export function lerp(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return a + (b - a) * k;
}

/** Convenience: round-and-lerp for pixel-snapped values (fontSize, padding). */
export function lerpRound(a: number, b: number, t: number): number {
  return Math.round(lerp(a, b, t));
}
