'use client';

import { useEffect, useState, useRef } from 'react';

import BoxScore from './BoxScore';
import PlayerGameLogPanel from './PlayerGameLogPanel';
import { Team, Schedule, BoxScores as BoxScoreType, TeamStats } from '@/app/types/schema';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { TEMP_TABLES } from '@/constants/tables';
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
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ entityId: string; name: string } | null>(null);
  const { evaluateQuery } = useMotherDuckClientState();
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

  // Reset state when gameId changes
  useEffect(() => {
    setData({ homeTeam: null, awayTeam: null, gameInfo: null });
    setLoading(true);
  }, [gameId]);

  // Load data when gameId changes
  useEffect(() => {
    if (!gameId) return;

    let cancelled = false;

    const loadData = async () => {
      try {
        // Fetch all data in parallel using Promise.all for better performance
        const [
          gameInfoResult,
          boxScoresResult,
          teamStatsResult
        ] = await Promise.all([
          evaluateQuery(`SELECT * FROM ${TEMP_TABLES.SCHEDULE} WHERE game_id = '${gameId}'`),
          evaluateQuery(`SELECT * FROM ${TEMP_TABLES.BOX_SCORES} WHERE game_id = '${gameId}' AND period = 'FullGame'`),
          evaluateQuery(`SELECT * FROM ${TEMP_TABLES.TEAM_STATS} WHERE game_id = '${gameId}'`)
        ]);

        const scheduleResult = [...gameInfoResult.data.toRows()].map(row => ({
          ...row,
          game_date: new Date(row.game_date + 'Z'),
          created_at: new Date(row.created_at + 'Z'),
          home_team_id: Number(row.home_team_id),
          away_team_id: Number(row.away_team_id),
          home_team_score: Number(row.home_team_score),
          away_team_score: Number(row.away_team_score)
        })) as Schedule[];

        const boxScores = [...boxScoresResult.data.toRows()].map(row => ({
          game_id: String(row.game_id),
          team_id: String(row.team_id),
          entity_id: String(row.entity_id),
          player_name: String(row.player_name),
          minutes: String(row.minutes),
          points: Number(row.points),
          rebounds: Number(row.rebounds),
          assists: Number(row.assists),
          steals: Number(row.steals),
          blocks: Number(row.blocks),
          turnovers: Number(row.turnovers),
          fg_made: Number(row.fg_made),
          fg_attempted: Number(row.fg_attempted),
          fg3_made: Number(row.fg3_made),
          fg3_attempted: Number(row.fg3_attempted),
          ft_made: Number(row.ft_made),
          ft_attempted: Number(row.ft_attempted),
          plus_minus: Number(row.plus_minus),
          starter: Number(row.starter),
          period: String(row.period)
        })) as BoxScoreType[];

        const teamStats = [...teamStatsResult.data.toRows()].map(row => ({
          game_id: String(row.game_id),
          team_id: String(row.team_id),
          period: String(row.period),
          minutes: String(row.minutes),
          points: Number(row.points),
          rebounds: Number(row.rebounds),
          assists: Number(row.assists),
          steals: Number(row.steals),
          blocks: Number(row.blocks),
          turnovers: Number(row.turnovers),
          fg_made: Number(row.fg_made),
          fg_attempted: Number(row.fg_attempted),
          fg3_made: Number(row.fg3_made),
          fg3_attempted: Number(row.fg3_attempted),
          ft_made: Number(row.ft_made),
          ft_attempted: Number(row.ft_attempted),
          offensive_possessions: Number(row.offensive_possessions),
          defensive_possessions: Number(row.defensive_possessions)
        })) as TeamStats[];



        if (cancelled) return;

        const [gameInfo] = scheduleResult;
        if (!gameInfo) return;

        const homeTeamPlayers = boxScores.filter(player => player.team_id === gameInfo.home_team_abbreviation);
        const awayTeamPlayers = boxScores.filter(player => player.team_id === gameInfo.away_team_abbreviation);

        const homeTeamStats = teamStats.find(stat => stat.team_id === gameInfo.home_team_abbreviation && stat.period === 'FullGame');
        const awayTeamStats = teamStats.find(stat => stat.team_id === gameInfo.away_team_abbreviation && stat.period === 'FullGame');

        if (!cancelled) {
          setData({
            gameInfo,
            homeTeam: {
              teamId: gameInfo.home_team_id.toString(),
              teamName: getTeamName(gameInfo.home_team_abbreviation),
              teamAbbreviation: gameInfo.home_team_abbreviation,
              score: homeTeamStats?.points || 0,
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
              })),
              ...homeTeamStats
            },
            awayTeam: {
              teamId: gameInfo.away_team_id.toString(),
              teamName: getTeamName(gameInfo.away_team_abbreviation),
              teamAbbreviation: gameInfo.away_team_abbreviation,
              score: awayTeamStats?.points || 0,
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
              })),
              ...awayTeamStats
            }
          });
        }
      } catch (error) {
        console.error('Error loading box score:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [gameId, evaluateQuery]);

  const handleClose = () => {
    setData({ homeTeam: null, awayTeam: null, gameInfo: null });
    onClose();
  };

  if (!gameId) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg p-3 ml-auto w-[80vw] h-full shadow-lg transition-transform duration-300 translate-x-0"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="relative h-full">
          <div className="absolute top-2 right-2 z-50">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              aria-label="Close panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-3 md:text-base text-[50%]">
            {loading ? (
              <div className="flex items-center justify-center h-[calc(100vh-120px)]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400" />
              </div>
            ) : data.homeTeam && data.awayTeam && data.gameInfo ? (
              <>
                <div className="mb-3">
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
                  <p className="text-gray-600 dark:text-gray-400 text-center mt-1 md:text-base text-sm">
                    {new Date(data.gameInfo.game_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)', padding: 0, paddingRight: '2px' }}>
                  <BoxScore 
                    homeTeam={data.homeTeam} 
                    awayTeam={data.awayTeam} 
                    onPlayerClick={(entityId, playerName) => setSelectedPlayer({ entityId, name: playerName })}
                  />
                </div>
                {selectedPlayer && (
                  <div className="fixed inset-0 z-[60] bg-black bg-opacity-50">
                    <PlayerGameLogPanel
                      entityId={selectedPlayer.entityId}
                      playerName={selectedPlayer.name}
                      onClose={() => setSelectedPlayer(null)}
                    />
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
