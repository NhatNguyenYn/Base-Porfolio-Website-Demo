type Level = "info" | "warn" | "error";

const SENSITIVE_KEY = /pass(word)?|secret|token|cookie|authorization|api[-_]?key|session/i;

/** Replaces values of sensitive keys before anything reaches stdout. */
function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    safe[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : value;
  }
  return safe;
}

/**
 * One JSON object per line so a log collector can parse it, with the fields an
 * operator needs and no request bodies, credentials or cookies.
 */
export function logEvent(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...redact(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
