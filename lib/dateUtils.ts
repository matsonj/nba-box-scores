/**
 * Converts a UTC date string to a local Date object
 * @param dateStr UTC date string
 * @returns Local Date object
 */
export function utcToLocalDate(dateStr: string): Date {
  const utcDate = new Date(dateStr + 'Z'); // Append Z to ensure UTC parsing
  return new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
}

/**
 * Parses a game date value (string or Date) into a consistent Date object.
 * Handles UTC strings that may or may not have a Z suffix.
 */
export function parseGameDate(dateValue: unknown): Date {
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'number' || typeof dateValue === 'bigint') return new Date(Number(dateValue));
  // Coerce to string for DuckDB WASM objects or other types
  const str = String(dateValue);
  return new Date(str.endsWith('Z') ? str : str + 'Z');
}
