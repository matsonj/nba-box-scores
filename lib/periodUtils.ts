import { MAX_PERIODS, REGULAR_PERIODS } from '@/constants/game';

interface PeriodScore {
  teamId: string;
  period: string;
  points: number;
}

export function getPeriodsToShow(periodScores?: PeriodScore[]): number[] {
  const maxPeriod = periodScores
    ? Math.max(...periodScores.map(ps => parseInt(ps.period)))
    : REGULAR_PERIODS;

  const count = Math.min(Math.max(maxPeriod, REGULAR_PERIODS), MAX_PERIODS);
  return Array.from({ length: count }, (_, i) => i + 1);
}

export function getPeriodLabel(period: number): string {
  if (period <= REGULAR_PERIODS) return period.toString();
  if (period === REGULAR_PERIODS + 1) return 'OT';
  return `OT${period - REGULAR_PERIODS}`;
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
