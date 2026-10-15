import { useEffect, useState } from "react";

/**
 * 1-second ticker aligned to the wall-clock second boundary.
 *
 * Without alignment, two clocks mounted milliseconds apart drift visibly
 * (one ticks at :00.250 while the other ticks at :00.480). Before every
 * tick we work out the time left until the next whole second and wait
 * exactly that long, so each tick re-snaps to the real clock instead of
 * slowly drifting away from it during long sessions.
 *
 * Returns a new `Date` each tick. The reference identity changes, so
 * components that only need a formatted string can `useMemo` on `now.getTime()`
 * to skip reconciliation when the visible output hasn't changed.
 */
export function useNow(tickMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = Math.max(0, tickMs - (Date.now() % tickMs));
      timeout = setTimeout(() => {
        setNow(new Date());
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timeout);
  }, [tickMs]);
  return now;
}
