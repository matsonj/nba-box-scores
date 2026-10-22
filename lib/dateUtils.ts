/**
 * Parses a date string as a local date (no UTC conversion).
 * Game dates are stored as local dates, not UTC timestamps.
 * @param dateStr Date string from the database
 * @returns Local Date object
 */
export function utcToLocalDate(dateStr: string): Date {
  const cleaned = dateStr.endsWith('Z') ? dateStr.slice(0, -1) : dateStr;
  return new Date(cleaned);
}

/**
 * Parses a game date value (string or Date) into a consistent Date object.
 * Game dates from MotherDuck are stored as date-only values (e.g. "2025-03-01 00:00:00")
 * representing the local game date, NOT UTC timestamps. We parse them as local dates
 * to avoid timezone shifts (e.g. March 1 midnight UTC becoming Feb 28 in US timezones).
 */
export function parseGameDate(dateValue: unknown): Date {
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'number' || typeof dateValue === 'bigint') return new Date(Number(dateValue));
  const str = String(dateValue);
  // Strip any trailing Z to prevent UTC interpretation — these are local dates
  const cleaned = str.endsWith('Z') ? str.slice(0, -1) : str;
  return new Date(cleaned);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

/**
 * Formats a date in local time using a date-fns style pattern. Supports the
 * tokens yyyy, yy, MMMM, MMM, MM, dd, do, d and EEEE.
 */
export function formatDate(date: Date | number, pattern: string): string {
  const d = new Date(date);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const tokens: Record<string, () => string> = {
    yyyy: () => String(d.getFullYear()),
    yy: () => pad(d.getFullYear() % 100),
    MMMM: () => MONTH_NAMES[d.getMonth()],
    MMM: () => MONTH_NAMES[d.getMonth()].slice(0, 3),
    MM: () => pad(d.getMonth() + 1),
    dd: () => pad(d.getDate()),
    do: () => ordinal(d.getDate()),
    d: () => String(d.getDate()),
    EEEE: () => DAY_NAMES[d.getDay()],
  };
  return pattern.replace(/yyyy|yy|MMMM|MMM|MM|dd|do|d|EEEE/g, (token) => tokens[token]());
}

/** Parses a "yyyy-MM-dd" string as a local date (midnight local time). */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
