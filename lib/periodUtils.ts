import { MAX_PERIODS, REGULAR_PERIODS } from '@/constants/game';

interface PeriodScore {
  teamId: string;
  period: string;
  points: number;
}

export function getPeriodsToShow(periodScores?: PeriodScore[], regularPeriods?: number, maxPeriodCount?: number, live?: boolean): number[] {
  if (!periodScores || periodScores.length === 0) {
    return [];
  }

  const maxPeriod = Math.max(...periodScores.map(ps => parseInt(ps.period)));

  if (live) {
    // Live games: show only periods that exist in data, no padding, no cap
    return Array.from({ length: maxPeriod }, (_, i) => i + 1);
  }

  const regPeriods = regularPeriods ?? REGULAR_PERIODS;
  const maxP = maxPeriodCount ?? MAX_PERIODS;
  const count = Math.min(Math.max(maxPeriod, regPeriods), maxP);
  return Array.from({ length: count }, (_, i) => i + 1);
}

export function getPeriodLabel(period: number, regularPeriods?: number): string {
  const regPeriods = regularPeriods ?? REGULAR_PERIODS;
  if (period <= regPeriods) return period.toString();
  if (period === regPeriods + 1) return 'OT';
  return `OT${period - regPeriods}`;
}

export function getPeriodPoints(
  periodScores: PeriodScore[] | undefined,
  period: number,
  teamAbbr: string
): string {
  return periodScores?.find(
    ps => ps.period === period.toString() && ps.teamId === teamAbbr
  )?.points?.toString() || '-';
}
