export const NHL_REGULAR_PERIODS = 3;
export const NHL_MAX_PERIODS = 5;

interface PeriodScore {
  teamId: string;
  period: string;
  points: number;
}

/**
 * Determines which periods to show for an NHL game.
 * Base is 3 periods, plus any OT or shootout columns.
 */
export function getNHLPeriodsToShow(
  periodScores?: PeriodScore[],
  regularPeriods: number = NHL_REGULAR_PERIODS,
  maxPeriods: number = NHL_MAX_PERIODS
): number[] {
  const maxPeriod = periodScores
    ? Math.max(...periodScores.map(ps => parseInt(ps.period)))
    : regularPeriods;

  const count = Math.min(Math.max(maxPeriod, regularPeriods), maxPeriods);
  return Array.from({ length: count }, (_, i) => i + 1);
}

/**
 * Returns the display label for an NHL period.
 * 1->"1st", 2->"2nd", 3->"3rd", 4->"OT", 5->"SO"
 * For playoff games with multiple OTs, pass isPlayoff=true:
 * 4->"OT", 5->"OT2", 6->"OT3", etc.
 */
export function getNHLPeriodLabel(period: number | string, isPlayoff: boolean = false): string {
  const p = typeof period === 'string' ? parseInt(period) : period;

  if (p === 1) return '1st';
  if (p === 2) return '2nd';
  if (p === 3) return '3rd';

  if (isPlayoff) {
    // Playoffs have no shootout, just multiple OTs
    if (p === 4) return 'OT';
    return `OT${p - 3}`;
  }

  // Regular season: period 4 is OT, period 5 is SO
  if (p === 4) return 'OT';
  if (p === 5) return 'SO';
  return `OT${p - 3}`;
}

/**
 * Extracts the points for a given period and team from period scores.
 */
export function getNHLPeriodPoints(
  periodScores: PeriodScore[] | undefined,
  period: number,
  teamAbbreviation: string
): string {
  return periodScores?.find(
    ps => ps.period === period.toString() && ps.teamId === teamAbbreviation
  )?.points?.toString() || '-';
}
