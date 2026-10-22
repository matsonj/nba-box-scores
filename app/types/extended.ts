import { Schedule } from './schema';

export interface PeriodScore {
  teamId: string;
  period: string;
  points: number;
}

export interface ScheduleWithBoxScore extends Schedule {
  boxScoreLoaded?: boolean;
  isPlayoff?: boolean;
  periodScores?: PeriodScore[];
}
