/**
 * Converts a UTC date string to a local Date object
 * @param dateStr UTC date string
 * @returns Local Date object
 */
export function utcToLocalDate(dateStr: string): Date {
  const utcDate = new Date(dateStr + 'Z'); // Append Z to ensure UTC parsing
  return new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
}
