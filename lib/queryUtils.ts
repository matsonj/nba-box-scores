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
 * Builds a SQL WHERE clause fragment for season filtering.
 * Returns '' if no filters apply, or ' AND ...' with leading AND.
 *
 * @param filters - Optional season year and type filters
 * @param alias - Optional table alias prefix (e.g. 's' produces 's.season_year')
 * @param playoffTypes - Playoff season_type values. NBA uses ['Playoffs', 'Play-In'], NHL uses ['Playoffs'].
 */
export function buildSeasonWhereClause(
  filters?: { seasonYear?: number; seasonType?: string },
  alias?: string,
  playoffTypes: string[] = ['Playoffs', 'Play-In']
): string {
  const clauses: string[] = [];
  const prefix = alias ? `${alias}.` : '';

  if (filters?.seasonYear) {
    clauses.push(`${prefix}season_year = ${filters.seasonYear}`);
  }

  if (filters?.seasonType && filters.seasonType !== 'all') {
    if (filters.seasonType === 'regular') {
      clauses.push(`${prefix}season_type = 'Regular Season'`);
    } else if (filters.seasonType === 'playoffs') {
      const types = playoffTypes.map(t => `'${t}'`).join(', ');
      clauses.push(`${prefix}season_type IN (${types})`);
    }
  }

  return clauses.length > 0 ? ' AND ' + clauses.join(' AND ') : '';
}