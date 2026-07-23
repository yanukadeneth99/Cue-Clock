/**
 * Time helpers - ports of the design reference's pure functions.
 *
 * Uses `Intl.DateTimeFormat` for zone conversion so we don't depend on Luxon at
 * call sites that only need a display string. The countdown helper deducts a
 * buffer (early-ready offset) and rolls forward 24h when the target is past.
 */

export type ZoneTime = {
  /** Hour string - padded ("14") in 24h mode, unpadded ("2") in 12h mode. */
  h: string;
  /** Minute string, zero-padded. */
  m: string;
  /** Second string, zero-padded. "00" when seconds are hidden. */
  s: string;
  /** "AM" / "PM" in 12h mode, empty in 24h mode. */
  ampm: string;
};

export type Countdown = {
  /** Zero-padded hour string of the remaining time. */
  h: string;
  m: string;
  s: string;
  /** Total seconds remaining (after buffer deducted). */
  total: number;
  /** total <= 300s. */
  warn: boolean;
  /** total <= 60s. */
  crit: boolean;
};

/** Render the current time in `tz` as parts ready for the clock rail. */
export function formatInZone(
  date: Date,
  tz: string,
  showSeconds = true,
  hour12 = false,
): ZoneTime {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: showSeconds ? "2-digit" : undefined,
      hour12,
    }).formatToParts(date);
    const get = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === t)?.value ?? "00";
    const rawH = get("hour");
    return {
      h: hour12 ? String(parseInt(rawH, 10)) : rawH,
      m: get("minute"),
      s: get("second") || "00",
      ampm: hour12 ? parts.find((p) => p.type === "dayPeriod")?.value ?? "" : "",
    };
  } catch {
    return { h: "00", m: "00", s: "00", ampm: "" };
  }
}

/** Format an (h, m) pair as "HH:MM" (24h) or "H:MM AM/PM" (12h). */
export function fmtHM(h: number, m: number, hour12 = false): string {
  if (!hour12) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Short timezone abbreviation ("BST", "EDT"). Falls back to the IANA suffix. */
export function zoneAbbr(date: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz.split("/").pop() ?? tz;
  } catch {
    return tz.split("/").pop() ?? tz;
  }
}

/** Last segment of an IANA timezone, underscores → spaces ("New York"). */
export function shortCity(tz: string): string {
  const name = tz.split("/").pop() || tz;
  return name.replace(/_/g, " ");
}

/**
 * Formatters are expensive to build, so we keep one per timezone and reuse it.
 * Only two zones are ever in play, so this map stays tiny.
 */
const countdownFormatters = new Map<string, Intl.DateTimeFormat>();

/** Get the reusable formatter for `tz`, building it the first time only. */
function getCountdownFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = countdownFormatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    countdownFormatters.set(tz, fmt);
  }
  return fmt;
}

/**
 * Compute time remaining until `target` (h/m in `tz`), minus `deductSeconds`.
 * Rolls forward 24h if the target is already past in the zone.
 *
 * The buffer is intentionally typed as a single `seconds` number rather than
 * a `{h, m}` pair: the existing data model stores buffers as
 * `(deductMinute, deductSecond)`, and the original API made it easy for
 * callers to misalign those into the wrong slots - silently under-deducting
 * by 60×. Centralising the unit conversion here removes that footgun.
 */
export function computeCountdown(
  now: Date,
  tz: string,
  target: { h: number; m: number },
  deductSeconds = 0,
): Countdown {
  // Project `now` into `tz` via Intl, then do integer second math.
  const fmt = getCountdownFormatter(tz).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parseInt(fmt.find((p) => p.type === t)?.value ?? "0", 10);
  const hour = get("hour") === 24 ? 0 : get("hour");
  const minute = get("minute");
  const second = get("second");

  const nowSec = hour * 3600 + minute * 60 + second;
  const tgtSec = target.h * 3600 + target.m * 60 - deductSeconds;
  let diff = tgtSec - nowSec;
  if (diff <= 0) diff += 86400;

  const hh = Math.floor(diff / 3600);
  const mm = Math.floor((diff % 3600) / 60);
  const ss = diff % 60;
  return {
    h: String(hh).padStart(2, "0"),
    m: String(mm).padStart(2, "0"),
    s: String(ss).padStart(2, "0"),
    total: diff,
    warn: diff <= 300,
    crit: diff <= 60,
  };
}

/** "5m left", "1h 12m left", "42s left" - used by the queued rows. */
export function humanRemaining(total: number): string {
  if (total <= 60) return `${total}s left`;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  if (hh > 0) return `${hh}h ${mm}m left`;
  return `${mm}m left`;
}
