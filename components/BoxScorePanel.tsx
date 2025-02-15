'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import BoxScore from './BoxScore';

import { Team, Schedule, BoxScore as BoxScoreType, TeamStats } from '@/app/types/schema';
import { useQueryDb } from '@/lib/db';
import { getTeamName } from '@/lib/teams';
import { useDebounce } from '@/hooks/useDebounce';

interface BoxScorePanelProps {
  gameId: string | null;
  onClose: () => void;
}

// Removed unused interface
// interface BoxScoreResponse {
//   gameInfo: Schedule;
//   teams: {
//     teamId: string;
//     teamName: string;
//     teamAbbreviation: string;
//     score: number;
//     players: Player[];
//   }[];
// }

export default function BoxScorePanel({ gameId, onClose }: BoxScorePanelProps) {
  const [data, setData] = useState<{
    homeTeam: Team | null;
    awayTeam: Team | null;
    gameInfo: Schedule | null;
  }>({ homeTeam: null, awayTeam: null, gameInfo: null });
  const queryDb = useQueryDb();

  useEffect(() => {
    if (!gameId) return;

    const loadData = async () => {
      try {
        const scheduleResult = await queryDb<Schedule>(`
          SELECT * FROM nba_box_scores.main.schedule WHERE game_id = '${gameId}'`
        );
        const [gameInfo] = scheduleResult;
        if (!gameInfo) return;

        const boxScores = await queryDb<BoxScoreType>(
          `SELECT * FROM nba_box_scores.main.box_scores WHERE game_id = '${gameId}' AND period = 'FullGame'`
        );

        const teamStats = await queryDb<TeamStats>(
          `SELECT * FROM nba_box_scores.main.team_stats WHERE game_id = '${gameId}'`
        );

        const homeTeamPlayers = boxScores.filter(player => player.team_id.toString() === gameInfo.home_team_id.toString());
        const awayTeamPlayers = boxScores.filter(player => player.team_id.toString() === gameInfo.away_team_id.toString());

        setData({
          gameInfo,
          homeTeam: {
            teamId: gameInfo.home_team_id.toString(),
            teamName: getTeamName(gameInfo.home_team_abbreviation),
            teamAbbreviation: gameInfo.home_team_abbreviation,
            score: teamStats.find(stat => stat.team_id.toString() === gameInfo.home_team_id.toString() && stat.period === 'FullGame')?.points || 0,
            players: homeTeamPlayers.map(player => ({
              playerId: player.player_id,
              playerName: player.player_name,
              minutes: player.minutes,
              points: player.points,
              rebounds: player.rebounds,
              assists: player.assists,
              steals: player.steals,
              blocks: player.blocks,
              turnovers: player.turnovers,
              fieldGoalsMade: player.fg_made,
              fieldGoalsAttempted: player.fg_attempted,
              threePointersMade: player.fg3_made,
              threePointersAttempted: player.fg3_attempted,
              freeThrowsMade: player.ft_made,
              freeThrowsAttempted: player.ft_attempted,
              plusMinus: player.plus_minus,
              starter: player.starter
            }))
          },
          awayTeam: {
            teamId: gameInfo.away_team_id.toString(),
            teamName: getTeamName(gameInfo.away_team_abbreviation),
            teamAbbreviation: gameInfo.away_team_abbreviation,
            score: teamStats.find(stat => stat.team_id.toString() === gameInfo.away_team_id.toString() && stat.period === 'FullGame')?.points || 0,
            players: awayTeamPlayers.map(player => ({
              playerId: player.player_id,
              playerName: player.player_name,
              minutes: player.minutes,
              points: player.points,
              rebounds: player.rebounds,
              assists: player.assists,
              steals: player.steals,
              blocks: player.blocks,
              turnovers: player.turnovers,
              fieldGoalsMade: player.fg_made,
              fieldGoalsAttempted: player.fg_attempted,
              threePointersMade: player.fg3_made,
              threePointersAttempted: player.fg3_attempted,
              freeThrowsMade: player.ft_made,
              freeThrowsAttempted: player.ft_attempted,
              plusMinus: player.plus_minus,
              starter: player.starter
            }))
          }
        });
      } catch (error) {
        console.error('Error loading box score:', error);
      }
    };

    loadData();
  }, [gameId, queryDb, getTeamName]);

  if (!gameId) return null;

  return (
    <div 
      className="fixed right-0 top-[88px] h-[calc(100vh-88px)] w-[80vw] bg-white dark:bg-gray-900 shadow-lg z-10"
    >
      <div className="relative h-full">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 md:text-base text-[50%]">
          {data.homeTeam && data.awayTeam && data.gameInfo && (
            <div className="mb-6">
              <h2 className="md:text-2xl text-lg text-center dark:text-white">
                {data.awayTeam.score > data.homeTeam.score ? (
                  <>
                    <span className="font-bold">* {data.awayTeam.teamAbbreviation} {data.awayTeam.score}</span>
                    {' - '}
                    <span>{data.homeTeam.teamAbbreviation} {data.homeTeam.score}</span>
                  </>
                ) : (
                  <>
                    <span>{data.awayTeam.teamAbbreviation} {data.awayTeam.score}</span>
                    {' - '}
                    <span className="font-bold">{data.homeTeam.teamAbbreviation} {data.homeTeam.score} *</span>
                  </>
                )}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mt-2 md:text-base text-sm">
                {format(new Date(data.gameInfo.game_date), 'MMMM d, yyyy • h:mm a')}
              </p>
            </div>
          )}
          
          {data.homeTeam && data.awayTeam && (
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              <BoxScore homeTeam={data.homeTeam} awayTeam={data.awayTeam} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
