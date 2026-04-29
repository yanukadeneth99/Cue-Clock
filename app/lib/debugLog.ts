// Internal-build-only diagnostic logger. Gated by EXPO_PUBLIC_DEBUG_LOGS, which
// is injected at build time only by .github/workflows/android-internal.yml.
// In release builds the flag is unset, so dlog() is a no-op and the ring buffer
// stays empty — even though the module ships in the JS bundle.
//
// Use via:  dlog("alarm:scheduled", { id, fireDate });

const ENABLED = !!process.env.EXPO_PUBLIC_DEBUG_LOGS;
const MAX_ENTRIES = 200;

interface LogEntry {
  ts: number;
  tag: string;
  payload?: unknown;
}

const buffer: LogEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) {
    try { fn(); } catch {}
  }
}

/** Record a tagged debug entry. No-op in release builds. */
export function dlog(tag: string, payload?: unknown): void {
  if (!ENABLED) return;
  buffer.push({ ts: Date.now(), tag, payload });
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  notify();
}

/** Whether logging is active in this build. */
export function isDebugLogEnabled(): boolean {
  return ENABLED;
}

/** Snapshot of all entries, oldest first. */
export function getLogs(): LogEntry[] {
  return buffer.slice();
}

/** Subscribe to buffer changes; returns unsubscribe. */
export function subscribeLogs(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Drop all entries. */
export function clearLogs(): void {
  buffer.length = 0;
  notify();
}

/** Format the buffer as a paste-ready string. */
export function formatLogs(): string {
  if (buffer.length === 0) return "(no log entries)";
  return buffer
    .map((e) => {
      const t = new Date(e.ts).toISOString();
      let payload = "";
      if (e.payload !== undefined) {
        try {
          payload = " " + (typeof e.payload === "string" ? e.payload : JSON.stringify(e.payload));
        } catch {
          payload = " [unserializable]";
        }
      }
      return `[${t}] ${e.tag}${payload}`;
    })
    .join("\n");
}
