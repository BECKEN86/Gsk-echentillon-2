/**
 * Date helpers for the app.
 * All business dates are stored as local-time strings:
 *   - "YYYY-MM-DD" for dates
 *   - "YYYY-MM-DD HH:mm" for datetimes
 * Using `new Date().toISOString()` stores UTC time, which shifts the
 * displayed hour and can shift the day near midnight. These helpers use
 * local time instead, and `parseAppDate` normalizes the space-separated
 * datetime format (invalid input for `new Date()` in Safari).
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" in local time */
export function formatAppDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD HH:mm" in local time */
export function formatAppDateTime(d: Date = new Date()): string {
  return `${formatAppDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Parses "YYYY-MM-DD", "YYYY-MM-DD HH:mm" and ISO strings.
 * `new Date("2026-10-18 14:30")` is invalid in Safari, so the space
 * separator is normalized to "T" first, with a manual-parse fallback.
 */
export function parseAppDate(dateStr: string | undefined | null): Date {
  if (!dateStr) return new Date(NaN);
  const s = String(dateStr).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) ? s.replace(' ', 'T') : s;
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  return new Date(NaN);
}
