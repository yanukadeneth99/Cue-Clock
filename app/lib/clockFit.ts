/**
 * Shrinks the clock card's time so it always fits on one line inside its card.
 *
 * The time row is "HH:MM" plus a small tail on its right: ":SS", "AM"/"PM", or both stacked. If the whole row fits at the normal sizes, the normal sizes are used. If not, the HH:MM size and the tail size are made smaller by the same amount until it fits. It never makes anything bigger.
 */

// Width of every Space Mono character, as a share of the font size. From app/assets/fonts/SpaceMono-Regular.ttf: every glyph is 612 wide on a 1000-unit grid (unitsPerEm 1000).
export const SPACE_MONO_ADVANCE = 612 / 1000;

// Width of "AM" in Inter SemiBold, the wider of "AM"/"PM", as a share of the font size. From Inter_600SemiBold.ttf in @expo-google-fonts/inter: A 1490 + M 1889 on a 2048-unit grid (unitsPerEm 2048).
export const INTER_AMPM_WIDTH = (1490 + 1889) / 2048;

// A little spare room, because phones and browsers round text sizes slightly differently.
const SAFETY = 2;

// Never shrink below this share of the normal size.
const MIN_SCALE = 0.4;

export type ClockFitInput = {
  /** Measured width of the time row. 0 before it has been measured. */
  rowWidth: number;
  /** The phone's text size setting (1 = normal). Phones grow text and letter spacing by this. */
  fontScale: number;
  /** Normal HH:MM size and its letter spacing (letter spacing is a fixed amount, it does not shrink with the font). */
  hhmmSize: number;
  hhmmSpacing: number;
  /** Normal size of the tail (":SS", or "AM"/"PM" when there are no seconds). */
  tailSize: number;
  /** Gap between HH:MM and the tail. */
  tailGap: number;
  showSeconds: boolean;
  secondsSpacing: number;
  /** "stacked": small AM/PM above the seconds (it keeps its size). "inline": AM/PM beside the minutes, no seconds. null: no AM/PM. */
  ampm: "stacked" | "inline" | null;
  stackedAmpmSize: number;
  stackedAmpmSpacing: number;
};

export type ClockFitResult = { hhmmSize: number; tailSize: number };

// Width of a run of Space Mono characters.
function monoWidth(chars: number, size: number, spacing: number): number {
  return chars * (SPACE_MONO_ADVANCE * size + spacing);
}

// Width of the whole time row when both sizes are multiplied by `scale`.
function rowWidthAt(input: ClockFitInput, scale: number): number {
  const f = input.fontScale > 0 ? input.fontScale : 1;
  const hhmm = monoWidth(5, input.hhmmSize * scale * f, input.hhmmSpacing * f);
  const tail = input.tailSize * scale * f;
  let tailWidth = 0;
  if (input.showSeconds) {
    tailWidth = monoWidth(3, tail, input.secondsSpacing * f);
    if (input.ampm === "stacked") {
      const ampm = (INTER_AMPM_WIDTH * input.stackedAmpmSize + 2 * input.stackedAmpmSpacing) * f;
      tailWidth = Math.max(tailWidth, ampm);
    }
  } else if (input.ampm === "inline") {
    tailWidth = INTER_AMPM_WIDTH * tail;
  }
  return hhmm + (tailWidth > 0 ? input.tailGap + tailWidth : 0);
}

export function fitClock(input: ClockFitInput): ClockFitResult {
  const normal = { hhmmSize: input.hhmmSize, tailSize: input.tailSize };
  // Not measured yet: show the normal sizes.
  if (!(input.rowWidth > 0)) return normal;
  const room = input.rowWidth - SAFETY;
  if (rowWidthAt(input, 1) <= room) return normal;

  // Find the largest scale that fits, by halving the search range.
  let low = MIN_SCALE;
  let high = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (rowWidthAt(input, mid) <= room) low = mid;
    else high = mid;
  }
  // Round down to whole sizes so the result is never wider than the room.
  return {
    hhmmSize: Math.floor(input.hhmmSize * low),
    tailSize: Math.floor(input.tailSize * low),
  };
}
