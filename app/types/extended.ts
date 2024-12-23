import { Schedule } from './schema';

export interface ScheduleWithBoxScore extends Schedule {
  boxScoreLoaded?: boolean;
  periodScores?: {
    teamId: string;
    period: string;
    points: number;
  }[];
}
