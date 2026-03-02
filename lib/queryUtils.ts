/**
 * Validates that a value contains only digits (for game IDs, entity IDs, etc.)
 * Throws an error if the value contains non-numeric characters.
 */
export function sanitizeNumericId(value: string): string {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid numeric ID: ${value}`);
  }
  return value;
}

/**
 * Escapes single quotes in SQL string literals by doubling them.
 */
export function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Validates that a value is a valid NBA team abbreviation (3 uppercase letters).
 */
export function sanitizeTeamAbbreviation(value: string): string {
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new Error(`Invalid team abbreviation: ${value}`);
  }
  return value;
}
