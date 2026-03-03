import { Schedule } from './schema';

export interface ScheduleWithBoxScore extends Schedule {
  boxScoreLoaded?: boolean;
  isPlayoff?: boolean;
  periodScores?: {
    teamId: string;
    period: string;
    points: number;
  }[];
}
