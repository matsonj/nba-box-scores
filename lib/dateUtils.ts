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
export function parseGameDate(dateValue: string | Date): Date {
  if (dateValue instanceof Date) return dateValue;
  const str = dateValue.endsWith('Z') ? dateValue : dateValue + 'Z';
  return new Date(str);
}
