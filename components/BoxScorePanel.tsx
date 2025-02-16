'use client';

import { useEffect, useState, useRef } from 'react';

import BoxScore from './BoxScore';

import { Team, Schedule, BoxScores as BoxScoreType, TeamStats } from '@/app/types/schema';
import { useQueryDb } from '@/lib/db';
import { getTeamName } from '@/lib/teams';

interface BoxScorePanelProps {
  gameId: string | null;
  onClose: () => void;
}

export default function BoxScorePanel({ gameId, onClose }: BoxScorePanelProps) {
  const [data, setData] = useState<{
    homeTeam: Team | null;
    awayTeam: Team | null;
    gameInfo: Schedule | null;
  }>({ homeTeam: null, awayTeam: null, gameInfo: null });
  const queryDb = useQueryDb();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    if (gameId) {
      document.body.style.overflow = 'hidden';
      panelRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [gameId]);

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
              playerId: player.entity_id,
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
              starter: player.starter === 1
            }))
          },
          awayTeam: {
            teamId: gameInfo.away_team_id.toString(),
            teamName: getTeamName(gameInfo.away_team_abbreviation),
            teamAbbreviation: gameInfo.away_team_abbreviation,
            score: teamStats.find(stat => stat.team_id.toString() === gameInfo.away_team_id.toString() && stat.period === 'FullGame')?.points || 0,
            players: awayTeamPlayers.map(player => ({
              playerId: player.entity_id,
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
              starter: player.starter === 1
            }))
          }
        });
      } catch (error) {
        console.error('Error loading box score:', error);
      }
    };

    loadData();
  }, [gameId, queryDb]);

  if (!gameId) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-lg p-6 ml-auto w-[80vw] h-full shadow-lg transition-transform duration-300 translate-x-0"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
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
                  {data.gameInfo.formatted_date}
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
    </div>
  );
}
