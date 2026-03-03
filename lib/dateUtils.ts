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
