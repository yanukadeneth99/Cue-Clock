import { useEffect, useState } from "react";

/**
 * 1-second ticker aligned to the wall-clock second boundary.
 *
 * Without alignment, two clocks mounted milliseconds apart drift visibly
 * (one ticks at :00.250 while the other ticks at :00.480). We schedule the
 * first tick at the next whole second and then interval at exactly 1000ms
 * thereafter so every consumer of the hook shares the same edge.
 *
 * Returns a new `Date` each tick. The reference identity changes, so
 * components that only need a formatted string can `useMemo` on `now.getTime()`
 * to skip reconciliation when the visible output hasn't changed.
 */
export function useNow(tickMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const align = 1000 - (Date.now() % 1000);
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), tickMs);
    }, align);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [tickMs]);
  return now;
}
